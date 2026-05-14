import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { projects, ticketActivity, tickets } from "../db/schema";
import type { LinkType, TicketSnapshot, ActivityInsert, Transaction } from "../lib/types";

const VALUE_FIELDS = ["title", "description", "priority", "visibility"] as const;
const REF_FIELDS = ["status", "assignee", "parent"] as const;

const COMMENT_EXCERPT_LIMIT = 200;

/**
 * Plaintext preview of a comment body for activity rows. Collapses runs of
 * whitespace, trims, and truncates to {@link COMMENT_EXCERPT_LIMIT} chars with
 * an ellipsis. Markdown is left intact - the renderer treats activity excerpts
 * as plaintext.
 */
function excerpt(body: string): string {
  const trimmed = body.replace(/\s+/g, " ").trim();
  if (trimmed.length <= COMMENT_EXCERPT_LIMIT) return trimmed;
  const slice = trimmed.slice(0, COMMENT_EXCERPT_LIMIT);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trimEnd()}...`;
}

export class ActivityService {
  /**
   * Emits a `created` row for a freshly inserted ticket. Called from inside
   * `TicketService.createTicket` with the post-insert row.
   * @param tx Active transaction - must be the same one the insert ran on.
   * @param userID The ID of the user creating the ticket.
   * @param ticket The newly inserted ticket's id and title.
   */
  static async logCreate(tx: Transaction, userID: string, ticket: Pick<TicketSnapshot, "id" | "title">) {
    await tx.insert(ticketActivity).values({
      ticketID: ticket.id,
      userID,
      action: "created",
      fieldName: null,
      oldValue: null,
      newValue: { value: ticket.title },
    });
  }

  /**
   * Emits a `deleted` row when a ticket is soft-deleted. Called from inside
   * `TicketService.softDeleteTicket` with the pre-delete row so the title is
   * preserved even after the ticket disappears from default queries.
   * @param tx Active transaction - must be the same one the soft-delete ran on.
   * @param userID The ID of the user deleting the ticket.
   * @param ticket The ticket's id and title captured before the delete.
   */
  static async logDelete(tx: Transaction, userID: string, ticket: Pick<TicketSnapshot, "id" | "title">) {
    await tx.insert(ticketActivity).values({
      ticketID: ticket.id,
      userID,
      action: "deleted",
      fieldName: null,
      oldValue: null,
      newValue: { value: ticket.title },
    });
  }

  /**
   * Emits a `restored` row when a soft-deleted ticket is brought back.
   * @param tx Active transaction - must be the same one the restore ran on.
   * @param userID The ID of the user restoring the ticket.
   * @param ticket The ticket's id and title at the time of restore.
   */
  static async logRestore(tx: Transaction, userID: string, ticket: Pick<TicketSnapshot, "id" | "title">) {
    await tx.insert(ticketActivity).values({
      ticketID: ticket.id,
      userID,
      action: "restored",
      fieldName: null,
      oldValue: null,
      newValue: { value: ticket.title },
    });
  }

  /**
   * Diffs before/after snapshots and writes one activity row per change.
   * @param tx Active transaction - must be the same one the update ran on.
   * @param userID The ID of the user performing the update.
   * @param before The ticket snapshot before the mutation.
   * @param after The ticket snapshot after the mutation.
   */
  static async logUpdate(tx: Transaction, userID: string, before: TicketSnapshot, after: TicketSnapshot) {
    const rows: ActivityInsert[] = [];
    const base = { ticketID: after.id, userID } as const;

    for (const field of VALUE_FIELDS) {
      if (before[field] === after[field]) continue;
      rows.push({
        ...base,
        action: "updated",
        fieldName: field,
        oldValue: { value: before[field] },
        newValue: { value: after[field] },
      });
    }

    for (const field of REF_FIELDS) {
      const b = before[field];
      const a = after[field];
      if ((b?.id ?? null) === (a?.id ?? null)) continue;
      rows.push({
        ...base,
        action: "updated",
        fieldName: `${field}ID`,
        oldValue: b ? { id: b.id, name: b.name } : null,
        newValue: a ? { id: a.id, name: a.name } : null,
      });
    }

    const beforeLabels = new Map(before.labels.map((l) => [l.id, l.name] as const));
    const afterLabels = new Map(after.labels.map((l) => [l.id, l.name] as const));
    for (const [id, name] of afterLabels) {
      if (beforeLabels.has(id)) continue;
      rows.push({ ...base, action: "label_added", fieldName: null, oldValue: null, newValue: { id, name } });
    }
    for (const [id, name] of beforeLabels) {
      if (afterLabels.has(id)) continue;
      rows.push({ ...base, action: "label_removed", fieldName: null, oldValue: { id, name }, newValue: null });
    }

    if (rows.length) await tx.insert(ticketActivity).values(rows);
  }

  /**
   * Emits an activity row for a comment lifecycle event. Called from inside
   * `CommentService` mutations on the same transaction so the comment row and
   * activity row commit atomically.
   *
   * Action / value shapes
   *   added   -> newValue: { id, excerpt }
   *   edited  -> oldValue: { body: prevBody }, newValue: { body: nextBody }
   *   deleted -> oldValue: { id, excerpt }
   *
   * @param tx Active transaction - must be the same one the comment mutation ran on.
   * @param event.userID The ID of the user performing the action.
   * @param event.ticketID The ID of the parent ticket.
   * @param event.kind Lifecycle event - "added", "edited", or "deleted".
   * @param event.comment The comment's id and body (post-mutation for added/edited, pre-mutation for deleted).
   * @param event.prevBody Previous body. Required for "edited" events; ignored otherwise.
   */
  static async logComment(
    tx: Transaction,
    event: {
      userID: string;
      ticketID: string;
      kind: "added" | "edited" | "deleted";
      comment: { id: string; body: string };
      prevBody?: string;
    }
  ) {
    const { userID, ticketID, kind, comment, prevBody } = event;
    const base = { ticketID, userID } as const;

    if (kind === "added") {
      await tx.insert(ticketActivity).values({
        ...base,
        action: "comment_added",
        fieldName: null,
        oldValue: null,
        newValue: { id: comment.id, excerpt: excerpt(comment.body) },
      });
      return;
    }

    if (kind === "edited") {
      await tx.insert(ticketActivity).values({
        ...base,
        action: "comment_edited",
        fieldName: null,
        oldValue: { body: prevBody ?? "" },
        newValue: { body: comment.body },
      });
      return;
    }

    await tx.insert(ticketActivity).values({
      ...base,
      action: "comment_deleted",
      fieldName: null,
      oldValue: { id: comment.id, excerpt: excerpt(comment.body) },
      newValue: null,
    });
  }

  /**
   * Emits activity rows for a link lifecycle event. Writes one row on each
   * side of the link with opposite `direction` snapshots so either ticket's
   * timeline reads correctly. Caller passes the same `tx` the
   * link mutation ran on so the rows commit together.
   * @param tx Active transaction
   * @param event.userID The ID of the user adding or removing the link
   * @param event.kind "added" or "removed"
   * @param event.linkType Canonical link type
   * @param event.source The source-side ticket snapshot (the side that owns the canonical row)
   * @param event.target The target-side ticket snapshot
   */
  static async logLink(
    tx: Transaction,
    event: {
      userID: string;
      kind: "added" | "removed";
      linkType: LinkType;
      source: { ticketID: string; number: number; title: string; projectKey: string };
      target: { ticketID: string; number: number; title: string; projectKey: string };
    }
  ) {
    const { userID, kind, linkType, source, target } = event;
    const action = kind === "added" ? "link_added" : "link_removed";
    const sourceValue = { ticketID: target.ticketID, number: target.number, title: target.title, projectKey: target.projectKey, direction: "outgoing" as const };
    const targetValue = { ticketID: source.ticketID, number: source.number, title: source.title, projectKey: source.projectKey, direction: "incoming" as const };

    await tx.insert(ticketActivity).values([
      {
        ticketID: source.ticketID,
        userID,
        action,
        fieldName: linkType,
        oldValue: kind === "added" ? null : sourceValue,
        newValue: kind === "added" ? sourceValue : null,
      },
      {
        ticketID: target.ticketID,
        userID,
        action,
        fieldName: linkType,
        oldValue: kind === "added" ? null : targetValue,
        newValue: kind === "added" ? targetValue : null,
      },
    ]);
  }

  /**
   * Emits an `attachment_added` or `attachment_removed` row for the parent
   * ticket. Caller passes the same `tx` the attachment mutation ran on.
   * Value shape: `{ id, filename }`.
   * @param tx Active transaction
   * @param event.userID The acting user
   * @param event.ticketID The parent ticket
   * @param event.kind "added" or "removed"
   * @param event.attachment The attachment's id and filename
   */
  static async logAttachment(
    tx: Transaction,
    event: {
      userID: string;
      ticketID: string;
      kind: "added" | "removed";
      attachment: { id: string; filename: string };
    }
  ) {
    const { userID, ticketID, kind, attachment } = event;
    const value = { id: attachment.id, filename: attachment.filename };
    await tx.insert(ticketActivity).values({
      ticketID,
      userID,
      action: kind === "added" ? "attachment_added" : "attachment_removed",
      fieldName: null,
      oldValue: kind === "added" ? null : value,
      newValue: kind === "added" ? value : null,
    });
  }

  /**
   * Returns all activity entries for a given ticket
   * @param ticketID The ID of the ticket
   * @returns The list of activity rows for the ticket
   */
  static async listForTicket(ticketID: string) {
    return db.query.ticketActivity.findMany({
      where: eq(ticketActivity.ticketID, ticketID),
      orderBy: [desc(ticketActivity.createdAt)],
      with: {
        user: { columns: { id: true, name: true, avatarURL: true } },
      },
    });
  }

  /**
   * Returns recent activity rows across every non-deleted ticket in a project.
   * Each row carries the acting user and the parent ticket's number/title so
   * the project-level feed can link straight to the source ticket.
   * @param projectID The ID of the project
   * @param limit Maximum number of rows to return (default 50)
   * @returns Activity rows newest-first with user and ticket joins
   */
  static async listForProject(projectID: string, limit = 50) {
    return db.query.ticketActivity.findMany({
      where: (activity, { exists }) =>
        exists(
          db
            .select({ id: tickets.id })
            .from(tickets)
            .where(and(eq(tickets.id, activity.ticketID), eq(tickets.projectID, projectID), isNull(tickets.deletedAt)))
        ),
      orderBy: [desc(ticketActivity.createdAt)],
      limit,
      with: {
        user: { columns: { id: true, name: true, avatarURL: true } },
        ticket: { columns: { id: true, number: true, title: true } },
      },
    });
  }

  /**
   * Returns recent activity rows across every non-deleted ticket in every
   * project. Each row carries the acting user, the parent ticket's number and
   * title, and the project key so the homepage feed can link straight to the
   * source ticket without any client-side join. When `publicOnly` is set,
   * events from private projects are filtered out so the result is safe to
   * expose to anonymous viewers.
   * @param limit Maximum number of rows to return (default 20)
   * @param options.publicOnly When true, restricts results to events whose project visibility is `public`
   * @returns Activity rows newest-first with user, ticket, and project joins
   */
  static async listGlobal(limit = 20, options: { publicOnly?: boolean } = {}) {
    const rows = await db.query.ticketActivity.findMany({
      where: (activity, { exists }) =>
        exists(
          db
            .select({ id: tickets.id })
            .from(tickets)
            .innerJoin(projects, eq(tickets.projectID, projects.id))
            .where(
              and(
                eq(tickets.id, activity.ticketID),
                isNull(tickets.deletedAt),
                options.publicOnly ? eq(projects.visibility, "public") : undefined
              )
            )
        ),
      orderBy: [desc(ticketActivity.createdAt)],
      limit,
      with: {
        user: { columns: { id: true, name: true, avatarURL: true } },
        ticket: {
          columns: { id: true, number: true, title: true },
          with: { project: { columns: { key: true } } },
        },
      },
    });

    return rows.map(({ ticket, ...rest }) => ({
      ...rest,
      ticket: { id: ticket.id, number: ticket.number, title: ticket.title },
      project: { key: ticket.project.key },
    }));
  }
}
