import { and, eq, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { db } from "../../db";
import { tickets } from "../../db/schema";
import type { TicketSnapshot, Transaction } from "../../lib/types";

export class TicketSnapshots {
  /**
   * Loads a {@link TicketSnapshot} from the DB or active transaction.
   * Accepts either `{ ticketID }` or `{ projectID, number }` as locator. Normalises FK
   * references to `{ id, name }` pairs so the activity differ can compare them directly
   * without a separate resolver.
   * @param handle The db or transaction to query through
   * @param locator Either the ticketID or the (projectID, number) pair
   * @returns The snapshot
   */
  static async load(handle: typeof db | Transaction, locator: { ticketID: string } | { projectID: string; number: number }): Promise<TicketSnapshot> {
    const where =
      "ticketID" in locator
        ? and(eq(tickets.id, locator.ticketID), isNull(tickets.deletedAt))
        : and(eq(tickets.projectID, locator.projectID), eq(tickets.number, locator.number), isNull(tickets.deletedAt));

    const row = await handle.query.tickets.findFirst({
      where,
      with: {
        status: { columns: { id: true, name: true } },
        reporter: { columns: { id: true, name: true } },
        assignee: { columns: { id: true, name: true } },
        parent: { columns: { id: true, title: true, deletedAt: true } },
        labels: { with: { label: { columns: { id: true, name: true } } } },
      },
    });

    if (!row) {
      const errorMessage = "ticketID" in locator ? `with id ${locator.ticketID}` : `#${locator.number}`;
      throw new HTTPException(404, { message: `Ticket ${errorMessage} not found.` });
    }

    return {
      id: row.id,
      number: row.number,
      title: row.title,
      description: row.description,
      priority: row.priority,
      visibility: row.visibility,
      status: { id: row.status.id, name: row.status.name },
      reporter: { id: row.reporter.id, name: row.reporter.name },
      assignee: row.assignee ? { id: row.assignee.id, name: row.assignee.name } : null,
      parent: row.parent && !row.parent.deletedAt ? { id: row.parent.id, name: row.parent.title } : null,
      labels: row.labels.map(l => ({ id: l.label.id, name: l.label.name })),
    };
  }
}
