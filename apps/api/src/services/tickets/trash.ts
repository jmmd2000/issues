import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../../db";
import { tickets } from "../../db/schema";
import { ActivityService } from "../activityService";

export class TicketTrash {
  /**
   * Soft deletes a ticket by setting `deletedAt` and writes a `deleted` activity row.
   * @param ticketID The ID of the ticket to delete
   * @param projectID The ID of the project the ticket belongs to
   * @param userID The ID of the user performing the delete (attributed on the activity row)
   * @throws HTTPException 404
   */
  static async softDeleteTicket(ticketID: string, projectID: string, userID: string) {
    await db.transaction(async tx => {
      const [ticket] = await tx
        .update(tickets)
        .set({ deletedAt: new Date() })
        .where(and(eq(tickets.id, ticketID), eq(tickets.projectID, projectID), isNull(tickets.deletedAt)))
        .returning({ id: tickets.id, title: tickets.title });
      if (!ticket) throw new HTTPException(404, { message: `Ticket with id ${ticketID} not found.` });

      await ActivityService.logDelete(tx, userID, ticket);
    });
  }

  /**
   * Hard deletes a ticket. Defensive: only soft-deleted tickets can be hard-
   * deleted via this path (the trash UI's "Delete forever" action). Returns
   * 404 if the ticket is missing or still active.
   * @param ticketID The ID of the ticket to delete
   * @param projectID The ID of the project the ticket belongs to
   * @throws HTTPException 404
   */
  static async hardDeleteTicket(ticketID: string, projectID: string) {
    const result = await db
      .delete(tickets)
      .where(and(eq(tickets.id, ticketID), eq(tickets.projectID, projectID), isNotNull(tickets.deletedAt)))
      .returning({ id: tickets.id });
    if (!result.length) throw new HTTPException(404, { message: `Ticket with id ${ticketID} not found.` });
  }

  /**
   * Restores a soft deleted ticket and writes a `restored` activity row.
   * Returns 404 if the ticket does not exist or was not soft-deleted at the
   * time of the call.
   * @param ticketID The ID of the ticket to restore
   * @param projectID The ID of the project the ticket belongs to
   * @param userID The ID of the user performing the restore (attributed on the activity row)
   * @throws HTTPException 404
   * @returns The restored ticket
   */
  static async restoreTicket(ticketID: string, projectID: string, userID: string) {
    return await db.transaction(async tx => {
      const [ticket] = await tx
        .update(tickets)
        .set({ deletedAt: null })
        .where(and(eq(tickets.id, ticketID), eq(tickets.projectID, projectID), isNotNull(tickets.deletedAt)))
        .returning();
      if (!ticket) throw new HTTPException(404, { message: `Ticket with id ${ticketID} not found.` });

      await ActivityService.logRestore(tx, userID, ticket);
      return ticket;
    });
  }

  /**
   * Looks up a soft-deleted ticket by its project-specific number. Used by
   * the restore route, which receives the ticket number rather than its id.
   * @param projectID The ID of the project the ticket belongs to
   * @param number The project-specific ticket number
   * @throws HTTPException 404
   * @returns The ticket id
   */
  static async getDeletedByNumber(projectID: string, number: number) {
    const ticket = await db.query.tickets.findFirst({
      columns: { id: true },
      where: and(eq(tickets.projectID, projectID), eq(tickets.number, number), isNotNull(tickets.deletedAt)),
    });
    if (!ticket) throw new HTTPException(404, { message: `Ticket #${number} not found.` });
    return ticket;
  }
}
