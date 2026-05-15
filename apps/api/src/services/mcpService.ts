import { and, asc, eq, ilike, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { formatTicketRef, parseTicketRef, STATUS_CATEGORIES } from "@issues/shared";
import type { LinkType } from "@issues/shared";
import { db } from "../db";
import { attachments, comments, labels, projectMembers, projects, statuses, ticketLabels, ticketLinks, tickets, users } from "../db/schema";
import { accessibleProjectIDs, canAccessProject } from "./accessService";
import type {
  ActivityValue,
  CompactActivity,
  CompactAttachment,
  CompactComment,
  CompactLabel,
  CompactLink,
  CompactMember,
  CompactProject,
  CompactProjectDetail,
  CompactSearchPage,
  CompactStats,
  CompactStatus,
  CompactTicket,
  CompactTicketDetail,
  Priority,
  SearchSortColumn,
  SearchSortDirection,
} from "../lib/types";
import { ActivityService } from "./activityService";
import { AttachmentService } from "./attachmentService";
import { CommentService } from "./commentService";
import { ProjectService } from "./projectService";
import { SearchService } from "./searchService";
import { TicketLinkService } from "./ticketLinkService";
import { TicketService } from "./ticketService";

const DESCRIPTION_EXCERPT_LENGTH = 200;
const SEARCH_PER_PAGE_DEFAULT = 25;
export const SEARCH_PER_PAGE_MAX = 50;
const ACTIVITY_LIMIT_DEFAULT = 30;
export const ACTIVITY_LIMIT_MAX = 100;

export type McpSearchParams = {
  q?: string;
  projectKey?: string;
  statusSlugs?: string[];
  priorities?: Priority[];
  labelNames?: string[];
  assigneeNames?: string[];
  page?: number;
  perPage?: number;
  sortBy?: SearchSortColumn;
  sortDirection?: SearchSortDirection;
};

export type McpCloneInput = {
  title: string;
  description?: string;
  statusSlug?: string;
  priority?: Priority;
  labels?: string[];
  assignee?: string | null;
  copyAttachments?: boolean;
};

export type McpLinkInput = {
  target: string;
  linkType: LinkType;
};

export type McpCreateInput = {
  projectKey: string;
  title: string;
  description?: string;
  statusSlug?: string;
  priority?: Priority;
  labels?: string[];
  assignee?: string | null;
};

export type McpPatchInput = {
  title?: string;
  description?: string;
  statusSlug?: string;
  priority?: Priority;
  labels?: string[];
  addLabels?: string[];
  removeLabels?: string[];
  assignee?: string | null;
};

type ProjectContext = { id: string; key: string };
type TicketContext = { ticketID: string; project: ProjectContext; number: number };

function toYYYYMMDD(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

function excerptDescription(text: string): string {
  const normalised = text.replace(/\s+/g, " ").trim();
  if (normalised.length <= DESCRIPTION_EXCERPT_LENGTH) return normalised;
  const clipped = normalised.slice(0, DESCRIPTION_EXCERPT_LENGTH).trimEnd();
  const lastSpace = clipped.lastIndexOf(" ");
  const boundary = lastSpace > DESCRIPTION_EXCERPT_LENGTH * 0.6 ? lastSpace : clipped.length;
  return `${clipped.slice(0, boundary)}...`;
}

function stringifyActivityValue(value: ActivityValue | null): string | null {
  if (!value) return null;
  if (value.value !== undefined) return value.value;
  if (value.name !== undefined) return value.name;
  if (value.excerpt !== undefined) return value.excerpt;
  if (value.body !== undefined) return value.body;
  if (value.title !== undefined) return value.title;
  if (value.filename !== undefined) return value.filename;
  return null;
}

export class McpService {
  /**
   * Lists every project the user is a member of, in compact form.
   * @param userID Authenticated user
   * @returns Compact project list
   */
  static async listProjects(userID: string): Promise<{ projects: CompactProject[] }> {
    const memberProjects = await accessibleProjectIDs(userID);
    const rows = await db
      .select({ key: projects.key, name: projects.name })
      .from(projects)
      .where(inArray(projects.id, memberProjects))
      .orderBy(asc(projects.key));
    return { projects: rows };
  }

  /**
   * Searches tickets visible to the user with optional filters. Results are
   * mapped to the compact ticket shape so MCP consumers see human-readable
   * status/label/priority strings instead of UUIDs.
   * @param userID Authenticated user
   * @param params Query, project key, and filters
   * @returns Compact ticket list
   */
  static async searchTickets(userID: string, params: McpSearchParams): Promise<CompactSearchPage> {
    const perPage = Math.min(params.perPage ?? SEARCH_PER_PAGE_DEFAULT, SEARCH_PER_PAGE_MAX);
    const page = params.page ?? 1;
    const assigneeIDs = params.assigneeNames?.length ? await McpService.resolveAssigneeNames(params.assigneeNames) : undefined;

    const result = await SearchService.search(
      {
        q: params.q,
        projectKey: params.projectKey,
        statusSlugs: params.statusSlugs,
        priorities: params.priorities,
        labelNames: params.labelNames,
        assigneeIDs,
        page,
        perPage,
        sortBy: params.sortBy,
        sortDirection: params.sortDirection,
      },
      userID
    );

    return {
      tickets: result.tickets.map((row) => ({
        ref: formatTicketRef(row.project.key, row.number),
        title: row.title,
        status: row.status.name,
        priority: row.priority,
        labels: row.labels.map((label) => label.name),
        created: toYYYYMMDD(row.createdAt),
        updated: toYYYYMMDD(row.updatedAt),
      })),
      total: result.total,
      page: result.page,
      perPage: result.perPage,
      hasNextPage: result.hasNextPage,
    };
  }

  /**
   * Fetches one ticket by its `ref` and returns compact detail. Description is
   * excerpted; comments are returned via {@link McpService.listComments}.
   * @param userID Authenticated user
   * @param ref Ticket ref string, e.g. "DASH-12"
   * @returns Compact ticket detail
   */
  static async getTicket(userID: string, ref: string, options: { full?: boolean } = {}): Promise<{ ticket: CompactTicketDetail }> {
    const { project, number } = await McpService.resolveTicketRef(userID, ref);
    const ticket = await TicketService.getTicketByNumber(project.id, number);

    const truncated = !options.full && ticket.description.length > DESCRIPTION_EXCERPT_LENGTH;
    const description = options.full ? ticket.description : excerptDescription(ticket.description);

    return {
      ticket: {
        ref: formatTicketRef(project.key, ticket.number),
        title: ticket.title,
        status: ticket.status.name,
        priority: ticket.priority,
        labels: ticket.labels.map((label) => label.name).sort((a, b) => a.localeCompare(b)),
        created: toYYYYMMDD(ticket.createdAt),
        updated: toYYYYMMDD(ticket.updatedAt),
        description,
        descriptionTruncated: truncated,
        assignee: ticket.assignee?.name ?? null,
        reporter: ticket.reporter.name,
      },
    };
  }

  /**
   * Creates a ticket. Resolves the status slug, label names, and assignee name
   * to IDs before delegating to {@link TicketService.createTicket}.
   * @param userID Authenticated user (used as reporter)
   * @param input Compact create payload
   * @returns Compact ticket summary
   */
  static async createTicket(userID: string, input: McpCreateInput): Promise<{ ticket: CompactTicket }> {
    const project = await McpService.resolveProject(userID, input.projectKey);

    const statusID = input.statusSlug ? await McpService.resolveStatusSlug(project.id, input.statusSlug) : await McpService.defaultStatusID(project.id);
    const labelIDs = input.labels ? await McpService.resolveLabelNames(project.id, input.labels) : undefined;
    const assigneeID = input.assignee === undefined ? undefined : input.assignee === null ? undefined : await McpService.resolveAssigneeName(input.assignee);

    const row = await TicketService.createTicket({
      projectID: project.id,
      reporterID: userID,
      title: input.title,
      description: input.description,
      statusID,
      priority: input.priority,
      assigneeID,
      labelIDs,
    });

    return await McpService.compactSummaryFor(project, row.number);
  }

  /**
   * Patches a ticket. Any field omitted is left untouched. Passing
   * `assignee: null` clears the assignee.
   * @param userID Authenticated user
   * @param ref Ticket ref
   * @param patch Compact patch payload
   * @returns Compact ticket summary
   */
  static async patchTicket(userID: string, ref: string, patch: McpPatchInput): Promise<{ ticket: CompactTicket }> {
    if (patch.labels !== undefined && (patch.addLabels?.length || patch.removeLabels?.length)) {
      throw new HTTPException(400, { message: "Cannot combine `labels` with `addLabels` or `removeLabels`." });
    }

    const context = await McpService.resolveTicketRef(userID, ref);

    const statusID = patch.statusSlug ? await McpService.resolveStatusSlug(context.project.id, patch.statusSlug) : undefined;
    const labelIDs = await McpService.computeLabelDelta(context.ticketID, context.project.id, patch);
    const assigneeID = patch.assignee === undefined ? undefined : patch.assignee === null ? null : await McpService.resolveAssigneeName(patch.assignee);

    await TicketService.patchTicket(context.ticketID, context.project.id, userID, {
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.description !== undefined && { description: patch.description }),
      ...(statusID !== undefined && { statusID }),
      ...(patch.priority !== undefined && { priority: patch.priority }),
      ...(labelIDs !== undefined && { labelIDs }),
      ...(assigneeID !== undefined && { assigneeID }),
    });

    return await McpService.compactSummaryFor(context.project, context.number);
  }

  /**
   * Adds a comment to a ticket.
   * @param userID Authenticated user (used as author)
   * @param ref Ticket ref
   * @param body Markdown body
   * @returns The new comment id
   */
  static async addComment(userID: string, ref: string, body: string): Promise<{ commentID: string }> {
    const context = await McpService.resolveTicketRef(userID, ref);
    const comment = await CommentService.createComment(context.ticketID, userID, body);
    return { commentID: comment.id };
  }

  /**
   * Lists every non-deleted comment on a ticket in chronological order.
   * Soft-deleted comments are excluded so the MCP consumer sees only live
   * discussion.
   * @param userID Authenticated user
   * @param ref Ticket ref
   * @returns Compact comment list
   */
  static async listComments(userID: string, ref: string): Promise<{ comments: CompactComment[] }> {
    const context = await McpService.resolveTicketRef(userID, ref);
    const rows = await CommentService.listForTicket(context.ticketID);
    const live = rows.filter((row) => !row.isDeleted);

    return {
      comments: live.map((row) => ({
        id: row.id,
        body: row.body ?? "",
        by: row.author.name,
        at: row.createdAt,
        edited: row.editedAt !== null,
      })),
    };
  }

  /**
   * Returns the most recent activity entries for a project, mapped to compact
   * shape with stringified old/new values.
   * @param userID Authenticated user
   * @param projectKey Project key
   * @param limit Maximum rows (default 30, max 100)
   * @returns Compact activity feed
   */
  static async getActivity(userID: string, projectKey: string, limit?: number): Promise<{ activity: CompactActivity[] }> {
    const project = await McpService.resolveProject(userID, projectKey);
    const cappedLimit = Math.min(limit ?? ACTIVITY_LIMIT_DEFAULT, ACTIVITY_LIMIT_MAX);
    const rows = await ActivityService.listForProject(project.id, cappedLimit);

    return {
      activity: rows.map((row) => ({
        ref: formatTicketRef(project.key, row.ticket?.number ?? 0),
        action: row.action,
        field: row.fieldName,
        oldValue: stringifyActivityValue(row.oldValue),
        newValue: stringifyActivityValue(row.newValue),
        by: row.user?.name ?? "system",
        at: row.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Returns a project with the lists Claude needs to make valid mutations:
   * members, statuses, and labels. Stats are excluded — call `getStats`
   * for those.
   * @param userID Authenticated user
   * @param projectKey Project key
   */
  static async getProject(userID: string, projectKey: string): Promise<{ project: CompactProjectDetail }> {
    const project = await db.query.projects.findFirst({
      where: eq(projects.key, projectKey.toUpperCase()),
      columns: { id: true, key: true, name: true, description: true },
      with: {
        statuses: { columns: { name: true, slug: true, category: true, position: true } },
        labels: { columns: { name: true, colour: true } },
        members: {
          columns: { role: true },
          with: { user: { columns: { id: true, name: true, email: true } } },
        },
      },
    });
    if (!project) throw new HTTPException(404, { message: `Project ${projectKey} not found.` });
    const isMember = project.members.some((member) => member.user.id === userID);
    if (!isMember) throw new HTTPException(404, { message: `Project ${projectKey} not found.` });

    return {
      project: {
        key: project.key,
        name: project.name,
        description: project.description,
        members: project.members.map((member) => ({ name: member.user.name, email: member.user.email, role: member.role })),
        statuses: project.statuses.slice().sort(McpService.compareStatuses).map(McpService.toCompactStatus),
        labels: project.labels.slice().sort((a, b) => a.name.localeCompare(b.name)).map(McpService.toCompactLabel),
      },
    };
  }

  /**
   * Lists project members by name + email + role. Subset of `getProject`
   * for callers that only need to know who can be assigned.
   */
  static async listMembers(userID: string, projectKey: string): Promise<{ members: CompactMember[] }> {
    const project = await McpService.resolveProject(userID, projectKey);
    const rows = await db
      .select({ name: users.name, email: users.email, role: projectMembers.role })
      .from(projectMembers)
      .innerJoin(users, eq(projectMembers.userID, users.id))
      .where(eq(projectMembers.projectID, project.id))
      .orderBy(asc(users.name));
    return { members: rows };
  }

  /**
   * Lists status definitions in display order (category, then name).
   * Subset of `getProject` for callers that only need to know valid slugs.
   */
  static async listStatuses(userID: string, projectKey: string): Promise<{ statuses: CompactStatus[] }> {
    const project = await McpService.resolveProject(userID, projectKey);
    const rows = await db
      .select({ name: statuses.name, slug: statuses.slug, category: statuses.category })
      .from(statuses)
      .where(eq(statuses.projectID, project.id));
    return { statuses: rows.sort(McpService.compareStatuses).map(McpService.toCompactStatus) };
  }

  /**
   * Lists label definitions alphabetically. Subset of `getProject` for
   * callers that only need to know valid label names.
   */
  static async listLabels(userID: string, projectKey: string): Promise<{ labels: CompactLabel[] }> {
    const project = await McpService.resolveProject(userID, projectKey);
    const rows = await db
      .select({ name: labels.name, colour: labels.colour })
      .from(labels)
      .where(eq(labels.projectID, project.id))
      .orderBy(asc(labels.name));
    return { labels: rows };
  }

  /**
   * Returns ticket counts for a project, including a per-member breakdown
   * keyed by user name (not ID) for Claude readability.
   */
  static async getStats(userID: string, projectKey: string): Promise<{ stats: CompactStats }> {
    const project = await McpService.resolveProject(userID, projectKey);
    const stats = await ProjectService.getStats(project.id);

    const memberIDs = Object.keys(stats.byMember);
    const nameRows = memberIDs.length
      ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, memberIDs))
      : [];
    const nameByID = new Map(nameRows.map((row) => [row.id, row.name]));

    const byMember: CompactStats["byMember"] = {};
    for (const [id, value] of Object.entries(stats.byMember)) {
      const name = nameByID.get(id) ?? id;
      byMember[name] = value;
    }

    return {
      stats: {
        total: stats.totalTickets,
        open: stats.openTickets,
        closed: stats.closedTickets,
        lastActivityAt: stats.lastActivityAt,
        byMember,
      },
    };
  }

  /**
   * Per-ticket activity feed. Mirrors {@link McpService.getActivity} but
   * scoped to one ticket.
   */
  static async getTicketActivity(userID: string, ref: string): Promise<{ activity: CompactActivity[] }> {
    const context = await McpService.resolveTicketRef(userID, ref);
    const rows = await ActivityService.listForTicket(context.ticketID);

    return {
      activity: rows.map((row) => ({
        ref: formatTicketRef(context.project.key, context.number),
        action: row.action,
        field: row.fieldName,
        oldValue: stringifyActivityValue(row.oldValue),
        newValue: stringifyActivityValue(row.newValue),
        by: row.user?.name ?? "system",
        at: row.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Soft-deletes a ticket. The row stays in the database with `deletedAt`
   * set, so `restoreTicket` can bring it back.
   */
  static async softDeleteTicket(userID: string, ref: string): Promise<{ ref: string }> {
    const context = await McpService.resolveTicketRef(userID, ref);
    await TicketService.softDeleteTicket(context.ticketID, context.project.id, userID);
    return { ref: formatTicketRef(context.project.key, context.number) };
  }

  /**
   * Restores a soft-deleted ticket. Fails 404 if the ref does not exist or
   * is not in the trash.
   */
  static async restoreTicket(userID: string, ref: string): Promise<{ ticket: CompactTicket }> {
    const context = await McpService.resolveDeletedTicketRef(userID, ref);
    await TicketService.restoreTicket(context.ticketID, context.project.id, userID);
    return await McpService.compactSummaryFor(context.project, context.number);
  }

  /**
   * Clones a ticket. The new ticket lives in the same project; fields default
   * to the source's values unless overridden. `copyAttachments` controls
   * whether attachment rows are duplicated (storage bytes are reused).
   */
  static async cloneTicket(userID: string, ref: string, input: McpCloneInput): Promise<{ ticket: CompactTicket }> {
    const context = await McpService.resolveTicketRef(userID, ref);
    const source = await TicketService.getTicketByNumber(context.project.id, context.number);

    const statusID = input.statusSlug ? await McpService.resolveStatusSlug(context.project.id, input.statusSlug) : source.statusID;
    const labelIDs = input.labels ? await McpService.resolveLabelNames(context.project.id, input.labels) : source.labels.map((label) => label.id);
    const assigneeID =
      input.assignee === undefined
        ? source.assignee?.id ?? undefined
        : input.assignee === null
          ? undefined
          : await McpService.resolveAssigneeName(input.assignee);

    const clone = await TicketService.cloneTicket(source.id, context.project.id, userID, {
      projectID: context.project.id,
      reporterID: userID,
      title: input.title,
      description: input.description ?? source.description,
      statusID,
      priority: input.priority ?? source.priority,
      assigneeID,
      labelIDs,
      copyAttachments: input.copyAttachments ?? false,
    });

    return await McpService.compactSummaryFor(context.project, clone.number);
  }

  /**
   * Lists every link involving a ticket, in both directions.
   */
  static async listLinks(userID: string, ref: string): Promise<{ links: CompactLink[] }> {
    const context = await McpService.resolveTicketRef(userID, ref);
    const rows = await TicketLinkService.listForTicket(context.ticketID);

    return {
      links: rows.map((row) => ({
        ref: formatTicketRef(row.ticket.projectKey, row.ticket.number),
        title: row.ticket.title,
        status: row.ticket.status.name,
        linkType: row.linkType,
        direction: row.direction,
      })),
    };
  }

  /**
   * Adds a link from `ref` to `input.target` of type `input.linkType`. The
   * viewing ticket is always stored as the source (outgoing direction).
   */
  static async addLink(userID: string, ref: string, input: McpLinkInput): Promise<{ link: CompactLink }> {
    const context = await McpService.resolveTicketRef(userID, ref);
    const source = await TicketService.getTicketByNumber(context.project.id, context.number);

    const link = await TicketLinkService.createLink({
      viewingTicketID: context.ticketID,
      viewingTicketRef: { number: source.number, title: source.title, projectKey: context.project.key },
      userID,
      targetRef: input.target,
      linkType: input.linkType,
      direction: "outgoing",
    });

    return {
      link: {
        ref: formatTicketRef(link.ticket.projectKey, link.ticket.number),
        title: link.ticket.title,
        status: link.ticket.status.name,
        linkType: link.linkType,
        direction: link.direction,
      },
    };
  }

  /**
   * Removes the link between `ref` and `input.target` of type `input.linkType`.
   * Tries the canonical (outgoing) direction first; on miss, tries the inverse
   * so callers don't need to know which side stores the row.
   */
  static async removeLink(userID: string, ref: string, input: McpLinkInput): Promise<void> {
    const context = await McpService.resolveTicketRef(userID, ref);
    const partner = await TicketLinkService.resolveTargetRef(input.target);

    const [row] = await db
      .select({ id: ticketLinks.id })
      .from(ticketLinks)
      .where(
        and(
          eq(ticketLinks.linkType, input.linkType),
          or(
            and(eq(ticketLinks.sourceTicketID, context.ticketID), eq(ticketLinks.targetTicketID, partner.id)),
            and(eq(ticketLinks.sourceTicketID, partner.id), eq(ticketLinks.targetTicketID, context.ticketID))
          )
        )
      )
      .limit(1);
    if (!row) throw new HTTPException(404, { message: `Link not found: ${ref} ${input.linkType} ${input.target}` });

    await TicketLinkService.deleteLink(row.id, context.ticketID, userID);
  }

  /**
   * Edits a comment by id. The caller must own a project membership through
   * the comment's parent ticket; `CommentService.updateComment` then enforces
   * that only the author can rewrite their own comment.
   */
  static async updateComment(userID: string, commentID: string, body: string): Promise<{ commentID: string }> {
    const ticketID = await McpService.resolveCommentTicket(userID, commentID);
    const comment = await CommentService.updateComment(commentID, ticketID, userID, body);
    return { commentID: comment.id };
  }

  /**
   * Soft-deletes a comment by id. Membership + authorship checks mirror
   * {@link McpService.updateComment}.
   */
  static async deleteComment(userID: string, commentID: string): Promise<void> {
    const ticketID = await McpService.resolveCommentTicket(userID, commentID);
    await CommentService.softDeleteComment(commentID, ticketID, userID);
  }

  /**
   * Lists every attachment on a ticket in compact form. Skips the storage key
   * (internal) and the FK ids; surfaces a public-style URL so Claude can hand
   * the link to the user without round-tripping.
   */
  static async listAttachments(userID: string, ref: string): Promise<{ attachments: CompactAttachment[] }> {
    const context = await McpService.resolveTicketRef(userID, ref);
    const rows = await AttachmentService.listForTicket(context.ticketID);

    return {
      attachments: rows.map((row) => ({
        id: row.id,
        filename: row.filename,
        sizeBytes: row.sizeBytes,
        mimeType: row.mimeType,
        isImage: row.isImage,
        by: row.uploader.name,
        at: row.createdAt,
        url: row.url,
      })),
    };
  }

  // -- resolution helpers ----------------------------------------------------

  private static toCompactStatus(status: { name: string; slug: string; category: CompactStatus["category"] }): CompactStatus {
    return { name: status.name, slug: status.slug, category: status.category };
  }

  private static toCompactLabel(label: { name: string; colour: string }): CompactLabel {
    return { name: label.name, colour: label.colour };
  }

  private static compareStatuses(a: { category: CompactStatus["category"]; name: string }, b: { category: CompactStatus["category"]; name: string }) {
    const categoryDelta = STATUS_CATEGORIES.indexOf(a.category) - STATUS_CATEGORIES.indexOf(b.category);
    if (categoryDelta !== 0) return categoryDelta;
    return a.name.localeCompare(b.name);
  }

  private static async resolveProject(userID: string, key: string): Promise<ProjectContext> {
    const memberProjects = await accessibleProjectIDs(userID);
    const [row] = await db
      .select({ id: projects.id, key: projects.key })
      .from(projects)
      .where(and(eq(projects.key, key.toUpperCase()), inArray(projects.id, memberProjects)))
      .limit(1);

    if (!row) throw new HTTPException(404, { message: `Project ${key} not found.` });
    return row;
  }

  private static async resolveTicketRef(userID: string, ref: string): Promise<TicketContext> {
    const parsed = parseTicketRef(ref);
    if (!parsed) throw new HTTPException(400, { message: `Invalid ticket ref: ${ref}` });

    const project = await McpService.resolveProject(userID, parsed.projectKey);
    const [ticket] = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(and(eq(tickets.projectID, project.id), eq(tickets.number, parsed.number), isNull(tickets.deletedAt)))
      .limit(1);

    if (!ticket) throw new HTTPException(404, { message: `Ticket ${ref} not found.` });
    return { ticketID: ticket.id, project, number: parsed.number };
  }

  private static async resolveCommentTicket(userID: string, commentID: string): Promise<string> {
    const [row] = await db
      .select({ ticketID: comments.ticketID, projectID: tickets.projectID })
      .from(comments)
      .innerJoin(tickets, eq(tickets.id, comments.ticketID))
      .where(eq(comments.id, commentID))
      .limit(1);
    if (!row) throw new HTTPException(404, { message: `Comment ${commentID} not found.` });

    if (!(await canAccessProject(userID, row.projectID))) throw new HTTPException(404, { message: `Comment ${commentID} not found.` });

    return row.ticketID;
  }

  private static async resolveDeletedTicketRef(userID: string, ref: string): Promise<TicketContext> {
    const parsed = parseTicketRef(ref);
    if (!parsed) throw new HTTPException(400, { message: `Invalid ticket ref: ${ref}` });

    const project = await McpService.resolveProject(userID, parsed.projectKey);
    const [ticket] = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(and(eq(tickets.projectID, project.id), eq(tickets.number, parsed.number), isNotNull(tickets.deletedAt)))
      .limit(1);

    if (!ticket) throw new HTTPException(404, { message: `Ticket ${ref} is not in the trash.` });
    return { ticketID: ticket.id, project, number: parsed.number };
  }

  private static async resolveStatusSlug(projectID: string, slug: string): Promise<string> {
    const [row] = await db.select({ id: statuses.id }).from(statuses).where(and(eq(statuses.projectID, projectID), eq(statuses.slug, slug))).limit(1);
    if (!row) throw new HTTPException(400, { message: `Unknown status slug: ${slug}` });
    return row.id;
  }

  private static async defaultStatusID(projectID: string): Promise<string> {
    const [row] = await db.select({ id: statuses.id }).from(statuses).where(eq(statuses.projectID, projectID)).orderBy(asc(statuses.position)).limit(1);
    if (!row) throw new HTTPException(500, { message: "Project has no statuses." });
    return row.id;
  }

  private static async resolveLabelNames(projectID: string, names: string[]): Promise<string[]> {
    if (!names.length) return [];
    const unique = Array.from(new Set(names));
    const rows = await db.select({ id: labels.id, name: labels.name }).from(labels).where(and(eq(labels.projectID, projectID), inArray(labels.name, unique)));
    if (rows.length !== unique.length) {
      const found = new Set(rows.map((row) => row.name));
      const missing = unique.filter((name) => !found.has(name));
      throw new HTTPException(400, { message: `Unknown label name(s): ${missing.join(", ")}` });
    }
    return rows.map((row) => row.id);
  }

  private static async resolveAssigneeName(name: string): Promise<string> {
    const [row] = await db.select({ id: users.id }).from(users).where(ilike(users.name, name)).limit(1);
    if (!row) throw new HTTPException(400, { message: `Unknown assignee: ${name}` });
    return row.id;
  }

  private static async resolveAssigneeNames(names: string[]): Promise<string[]> {
    const unique = Array.from(new Set(names));
    const rows = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.name, unique));
    if (rows.length !== unique.length) {
      const found = new Set(rows.map((row) => row.name));
      const missing = unique.filter((name) => !found.has(name));
      throw new HTTPException(400, { message: `Unknown assignee(s): ${missing.join(", ")}` });
    }
    return rows.map((row) => row.id);
  }

  private static async compactSummaryFor(project: ProjectContext, number: number): Promise<{ ticket: CompactTicket }> {
    const ticket = await TicketService.getTicketByNumber(project.id, number);
    return {
      ticket: {
        ref: formatTicketRef(project.key, ticket.number),
        title: ticket.title,
        status: ticket.status.name,
        priority: ticket.priority,
        labels: ticket.labels.map((label) => label.name).sort((a, b) => a.localeCompare(b)),
        created: toYYYYMMDD(ticket.createdAt),
        updated: toYYYYMMDD(ticket.updatedAt),
      },
    };
  }

  /**
   * Resolves the label IDs that should land on a ticket after a patch. Returns
   * `undefined` to mean "don't touch labels". When `labels` is set it replaces
   * the full set; when `addLabels`/`removeLabels` are set, the current rows
   * are fetched and the delta is applied.
   */
  private static async computeLabelDelta(ticketID: string, projectID: string, patch: McpPatchInput): Promise<string[] | undefined> {
    if (patch.labels !== undefined) return await McpService.resolveLabelNames(projectID, patch.labels);
    if (!patch.addLabels?.length && !patch.removeLabels?.length) return undefined;

    const [addIDs, removeIDs, currentRows] = await Promise.all([
      patch.addLabels?.length ? McpService.resolveLabelNames(projectID, patch.addLabels) : Promise.resolve([] as string[]),
      patch.removeLabels?.length ? McpService.resolveLabelNames(projectID, patch.removeLabels) : Promise.resolve([] as string[]),
      db.select({ labelID: ticketLabels.labelID }).from(ticketLabels).where(eq(ticketLabels.ticketID, ticketID)),
    ]);

    const next = new Set(currentRows.map((row) => row.labelID));
    for (const id of addIDs) next.add(id);
    for (const id of removeIDs) next.delete(id);
    return Array.from(next);
  }
}
