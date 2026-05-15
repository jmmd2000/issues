import { and, asc, eq, ilike, inArray, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { formatTicketRef, parseTicketRef } from "@issues/shared";
import { db } from "../db";
import { labels, projectMembers, projects, statuses, ticketLabels, tickets, users } from "../db/schema";
import type { ActivityValue, CompactActivity, CompactComment, CompactProject, CompactTicket, CompactTicketDetail, Priority } from "../lib/types";
import { ActivityService } from "./activityService";
import { CommentService } from "./commentService";
import { SearchService } from "./searchService";
import { TicketService } from "./ticketService";

const DESCRIPTION_EXCERPT_LENGTH = 200;
const SEARCH_LIMIT_DEFAULT = 25;
export const SEARCH_LIMIT_MAX = 50;
const ACTIVITY_LIMIT_DEFAULT = 30;
export const ACTIVITY_LIMIT_MAX = 100;

export type McpSearchParams = {
  q?: string;
  projectKey?: string;
  statusSlugs?: string[];
  priorities?: Priority[];
  labelNames?: string[];
  assigneeNames?: string[];
  limit?: number;
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
  assignee?: string | null;
};

export type McpBulkPatch = {
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
    const rows = await db
      .select({ key: projects.key, name: projects.name })
      .from(projects)
      .innerJoin(projectMembers, and(eq(projectMembers.projectID, projects.id), eq(projectMembers.userID, userID)))
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
  static async searchTickets(userID: string, params: McpSearchParams): Promise<{ tickets: CompactTicket[] }> {
    const limit = Math.min(params.limit ?? SEARCH_LIMIT_DEFAULT, SEARCH_LIMIT_MAX);
    const assigneeIDs = params.assigneeNames?.length ? await McpService.resolveAssigneeNames(params.assigneeNames) : undefined;

    const result = await SearchService.search(
      {
        q: params.q,
        projectKey: params.projectKey,
        statusSlugs: params.statusSlugs,
        priorities: params.priorities,
        labelNames: params.labelNames,
        assigneeIDs,
        page: 1,
        perPage: limit,
      },
      userID
    );

    return { tickets: result.tickets.map((row) => ({ ref: formatTicketRef(row.project.key, row.number), title: row.title, status: row.status.name, priority: row.priority, labels: row.labels.map((label) => label.name), updated: toYYYYMMDD(row.updatedAt) })) };
  }

  /**
   * Fetches one ticket by its `ref` and returns compact detail. Description is
   * excerpted; comments are returned via {@link McpService.listComments}.
   * @param userID Authenticated user
   * @param ref Ticket ref string, e.g. "DASH-12"
   * @returns Compact ticket detail
   */
  static async getTicket(userID: string, ref: string): Promise<{ ticket: CompactTicketDetail }> {
    const { project, number } = await McpService.resolveTicketRef(userID, ref);
    const ticket = await TicketService.getTicketByNumber(project.id, number);

    return {
      ticket: {
        ref: formatTicketRef(project.key, ticket.number),
        title: ticket.title,
        status: ticket.status.name,
        priority: ticket.priority,
        labels: ticket.labels.map((label) => label.name).sort((a, b) => a.localeCompare(b)),
        updated: toYYYYMMDD(ticket.updatedAt),
        description: excerptDescription(ticket.description),
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
    const context = await McpService.resolveTicketRef(userID, ref);

    const statusID = patch.statusSlug ? await McpService.resolveStatusSlug(context.project.id, patch.statusSlug) : undefined;
    const labelIDs = patch.labels ? await McpService.resolveLabelNames(context.project.id, patch.labels) : undefined;
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
   * Applies the same patch to many tickets. Resolves every ref and every
   * referenced status/label/assignee name up-front so that any invalid input
   * fails the whole call before the first mutation. Subsequent patch calls go
   * through {@link TicketService.patchTicket} so activity logging and the
   * `trackChanges` snapshot still fire per ticket.
   * @param userID Authenticated user
   * @param refs Ticket refs
   * @param patch Compact patch with optional add/remove label deltas
   * @returns Count of updated tickets
   */
  static async bulkUpdate(userID: string, refs: string[], patch: McpBulkPatch): Promise<{ updated: number }> {
    if (refs.length === 0) return { updated: 0 };
    if (patch.labels !== undefined && (patch.addLabels?.length || patch.removeLabels?.length)) {
      throw new HTTPException(400, { message: "Cannot combine `labels` with `addLabels` or `removeLabels`." });
    }

    const contexts = await Promise.all(refs.map((ref) => McpService.resolveTicketRef(userID, ref)));
    const projectIDs = new Set(contexts.map((context) => context.project.id));
    if (projectIDs.size > 1) {
      throw new HTTPException(400, { message: "Bulk updates must target tickets in a single project." });
    }
    const projectID = contexts[0].project.id;

    const statusID = patch.statusSlug ? await McpService.resolveStatusSlug(projectID, patch.statusSlug) : undefined;
    const replacementLabelIDs = patch.labels ? await McpService.resolveLabelNames(projectID, patch.labels) : undefined;
    const addLabelIDs = patch.addLabels?.length ? await McpService.resolveLabelNames(projectID, patch.addLabels) : [];
    const removeLabelIDs = patch.removeLabels?.length ? new Set(await McpService.resolveLabelNames(projectID, patch.removeLabels)) : new Set<string>();
    const assigneeID = patch.assignee === undefined ? undefined : patch.assignee === null ? null : await McpService.resolveAssigneeName(patch.assignee);

    let updated = 0;
    for (const context of contexts) {
      let labelIDs: string[] | undefined = replacementLabelIDs;
      if (labelIDs === undefined && (addLabelIDs.length || removeLabelIDs.size)) {
        const current = await db.select({ labelID: ticketLabels.labelID }).from(ticketLabels).where(eq(ticketLabels.ticketID, context.ticketID));
        const next = new Set(current.map((row) => row.labelID));
        for (const id of addLabelIDs) next.add(id);
        for (const id of removeLabelIDs) next.delete(id);
        labelIDs = Array.from(next);
      }

      await TicketService.patchTicket(context.ticketID, projectID, userID, {
        ...(statusID !== undefined && { statusID }),
        ...(patch.priority !== undefined && { priority: patch.priority }),
        ...(labelIDs !== undefined && { labelIDs }),
        ...(assigneeID !== undefined && { assigneeID }),
      });
      updated += 1;
    }

    return { updated };
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

  // -- resolution helpers ----------------------------------------------------

  private static async resolveProject(userID: string, key: string): Promise<ProjectContext> {
    const [row] = await db
      .select({ id: projects.id, key: projects.key })
      .from(projects)
      .innerJoin(projectMembers, and(eq(projectMembers.projectID, projects.id), eq(projectMembers.userID, userID)))
      .where(eq(projects.key, key.toUpperCase()))
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
        updated: toYYYYMMDD(ticket.updatedAt),
      },
    };
  }
}
