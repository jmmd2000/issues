import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { ticketActivity } from "../db/schema";
import type { TicketSnapshot, ActivityInsert, Transaction } from "../lib/types";

const VALUE_FIELDS = ["title", "description", "priority"] as const;
const REF_FIELDS = ["status", "assignee", "parent"] as const;

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
}
