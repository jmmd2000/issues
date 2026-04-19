import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../db";
import { tickets, ticketCounters, ticketLabels } from "../db/schema";
import { positionAfter, positionBetween } from "../lib/position";
import type { Priority } from "../lib/types";

export class TicketService {
  /**
   * Create a ticket in a project. Increments the project's ticket counter and attaches any labels.
   * @param data The ticket fields plus `projectID` and `reporterID` from the route.
   * @throws HTTPException 500
   * @returns The created ticket
   */
  static async createTicket(data: {
    projectID: string;
    reporterID: string;
    title: string;
    description?: string;
    statusID: string;
    priority?: Priority;
    assigneeID?: string;
    labelIDs?: string[];
    parentTicketID?: string;
  }) {
    return await db.transaction(async (tx) => {
      const [counter] = await tx
        .update(ticketCounters)
        .set({ lastNumber: sql`${ticketCounters.lastNumber} + 1` })
        .where(eq(ticketCounters.projectID, data.projectID))
        .returning({ nextNumber: ticketCounters.lastNumber });

      if (!counter) throw new HTTPException(500, { message: "Ticket counter missing for project." });

      const [tail] = await tx
        .select({ position: tickets.position })
        .from(tickets)
        .where(and(eq(tickets.projectID, data.projectID), eq(tickets.statusID, data.statusID), isNull(tickets.deletedAt)))
        .orderBy(desc(tickets.position))
        .limit(1);

      const [ticket] = await tx
        .insert(tickets)
        .values({
          projectID: data.projectID,
          number: counter.nextNumber,
          title: data.title,
          description: data.description ?? "",
          statusID: data.statusID,
          priority: data.priority ?? "medium",
          position: positionAfter(tail?.position ?? null),
          reporterID: data.reporterID,
          assigneeID: data.assigneeID ?? null,
          parentTicketID: data.parentTicketID ?? null,
        })
        .returning();

      if (data.labelIDs?.length) {
        await tx.insert(ticketLabels).values(data.labelIDs.map((labelID) => ({ ticketID: ticket.id, labelID })));
      }

      return ticket;
    });
  }

  /**
   * Gets a ticket by its id.
   * @param ticketID The uuid of the ticket
   * @throws HTTPException 404
   * @returns The ticket.
   */
  static async getTicketByID(ticketID: string) {
    const ticket = await db.query.tickets.findFirst({
      where: and(eq(tickets.id, ticketID), isNull(tickets.deletedAt)),
    });

    if (!ticket) throw new HTTPException(404, { message: `Ticket with id ${ticketID} not found` });
    return ticket;
  }

  /**
   * Gets a ticket by its project-specific number i.e. XXXX-42
   * @param projectID The ID of the project the ticket belongs to.
   * @param number The project-specific ticket number
   * @throws HTTPException 404
   * @returns The ticket with labels, status, reporter and assignee.
   */
  static async getTicketByNumber(projectID: string, number: number) {
    const ticket = await db.query.tickets.findFirst({
      where: and(eq(tickets.projectID, projectID), eq(tickets.number, number), isNull(tickets.deletedAt)),
      with: {
        status: true,
        reporter: { columns: { id: true, name: true, avatarURL: true } },
        assignee: { columns: { id: true, name: true, avatarURL: true } },
        labels: { with: { label: true } },
      },
    });

    if (!ticket) throw new HTTPException(404, { message: `Ticket #${number} not found` });
    return ticket;
  }

  /**
   * Lists tickets for a project with optional filters. Excludes soft-deleted tickets.
   * @param projectID The ID of the project
   * @param filters Optional filters (status slug, priority, assignee ID, pagination)
   * @returns
   */
  static async listForProject(
    projectID: string,
    filters: {
      statusID?: string;
      priority?: Priority;
      assigneeID?: string;
      page?: number;
      perPage?: number;
    }
  ) {
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 25;

    const where = [eq(tickets.projectID, projectID), isNull(tickets.deletedAt)];
    if (filters.statusID) where.push(eq(tickets.statusID, filters.statusID));
    if (filters.priority) where.push(eq(tickets.priority, filters.priority));
    if (filters.assigneeID) where.push(eq(tickets.assigneeID, filters.assigneeID));

    return await db.query.tickets.findMany({
      where: and(...where),
      orderBy: [desc(tickets.updatedAt)],
      limit: perPage,
      offset: (page - 1) * perPage,
    });
  }

  /**
   * Updates a ticket's data. Caller must have verified member access via requireProjectAccess.
   * @param ticketID The ID of the ticket to update
   * @param projectID The ID of the project that the ticket belongs to
   * @param data The fields to update
   * @throws HTTPException 404
   * @returns The updated ticket
   */
  static async patchTicket(
    ticketID: string,
    projectID: string,
    data: {
      title?: string;
      description?: string;
      statusID?: string;
      priority?: Priority;
      assigneeID?: string | null;
      parentTicketID?: string | null;
    }
  ) {
    const [ticket] = await db
      .update(tickets)
      .set(data)
      .where(and(eq(tickets.id, ticketID), eq(tickets.projectID, projectID), isNull(tickets.deletedAt)))
      .returning();
    if (!ticket) throw new HTTPException(404, { message: `Ticket with id ${ticketID} not found.` });
    return ticket;
  }

  /**
   * Moves a ticket within a kanban column, optionally changing status.
   * Computes a new fractional-index position between the given neighbours.
   * @param ticketID The ID of the ticket to move
   * @param projectID The ID of the project that the ticket belongs to
   * @param data The target status (optional) and neighbour ticket IDs (beforeID, afterID)
   * @throws HTTPException 404
   * @returns The updated ticket
   */
  static async moveTicket(
    ticketID: string,
    projectID: string,
    data: {
      statusID?: string;
      beforeID?: string | null;
      afterID?: string | null;
    }
  ) {
    const [before, after] = await Promise.all([data.beforeID ? this.getTicketByID(data.beforeID) : null, data.afterID ? this.getTicketByID(data.afterID) : null]);
    const newPosition = positionBetween(before?.position ?? null, after?.position ?? null);

    const update: { position: string; statusID?: string } = { position: newPosition };
    if (data.statusID) update.statusID = data.statusID;

    const [ticket] = await db
      .update(tickets)
      .set(update)
      .where(and(eq(tickets.id, ticketID), eq(tickets.projectID, projectID), isNull(tickets.deletedAt)))
      .returning();

    if (!ticket) throw new HTTPException(404, { message: `Ticket with id ${ticketID} not found.` });
    return ticket;
  }

  /**
   * Soft deletes a ticket by setting `deletedAt`.
   * @param ticketID The ID of the ticket to delete
   * @param projectID The ID of the project the ticket belongs to
   * @throws HTTPException 404
   */
  static async softDeleteTicket(ticketID: string, projectID: string) {
    const [ticket] = await db
      .update(tickets)
      .set({ deletedAt: new Date() })
      .where(and(eq(tickets.id, ticketID), eq(tickets.projectID, projectID), isNull(tickets.deletedAt)))
      .returning();
    if (!ticket) throw new HTTPException(404, { message: `Ticket with id ${ticketID} not found.` });
  }

  /**
   * Hard deletes a ticket.
   * @param ticketID The ID of the ticket to delete
   * @param projectID The ID of the project the ticket belongs to
   */
  static async hardDeleteTicket(ticketID: string, projectID: string) {
    await db.delete(tickets).where(and(eq(tickets.id, ticketID), eq(tickets.projectID, projectID)));
  }

  /**
   * Restores a soft deleted ticket.
   * @param ticketID The ID of the ticket to restore
   * @param projectID The ID of the project the ticket belongs to
   * @throws HTTPException 404
   * @returns The restored ticket
   */
  static async restoreTicket(ticketID: string, projectID: string) {
    const [ticket] = await db
      .update(tickets)
      .set({ deletedAt: null })
      .where(and(eq(tickets.id, ticketID), eq(tickets.projectID, projectID)))
      .returning();
    if (!ticket) throw new HTTPException(404, { message: `Ticket with id ${ticketID} not found.` });
    return ticket;
  }
}
