import { and, desc, eq, ilike, isNull, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../db";
import { tickets, ticketCounters, ticketLabels } from "../db/schema";
import { positionAfter, positionBetween } from "../lib/position";
import type { Priority, TicketSnapshot, Transaction } from "../lib/types";
import { ActivityService } from "./activityService";

export class TicketService {
  /**
   * Create a ticket in a project. Increments the project's ticket counter,
   * attaches any labels, and writes a `created` activity row. All work runs in
   * a single transaction.
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

      await ActivityService.logCreate(tx, data.reporterID, ticket);

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
        parent: { columns: { id: true, number: true, title: true } },
        labels: { with: { label: true } },
      },
    });

    if (!ticket) throw new HTTPException(404, { message: `Ticket #${number} not found` });
    return {
      ...ticket,
      labels: ticket.labels.map(({ label }) => label),
    };
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
      titleSearch?: string;
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
    if (filters.titleSearch) where.push(ilike(tickets.title, `%${filters.titleSearch}%`));

    return await db.query.tickets.findMany({
      where: and(...where),
      orderBy: [desc(tickets.updatedAt)],
      limit: perPage,
      offset: (page - 1) * perPage,
    });
  }

  /**
   * Lists the full kanban board for a project, ordered by column and position.
   * Excludes soft-deleted tickets.
   * @param projectID The ID of the project
   * @param filters Optional board filters
   * @returns The board tickets
   */
  static async listBoardForProject(
    projectID: string,
    filters: {
      statusID?: string;
      priority?: Priority;
      assigneeID?: string;
    }
  ) {
    const where = [eq(tickets.projectID, projectID), isNull(tickets.deletedAt)];
    if (filters.statusID) where.push(eq(tickets.statusID, filters.statusID));
    if (filters.priority) where.push(eq(tickets.priority, filters.priority));
    if (filters.assigneeID) where.push(eq(tickets.assigneeID, filters.assigneeID));

    return await db.query.tickets.findMany({
      where: and(...where),
      orderBy: [tickets.statusID, sql`${tickets.position} COLLATE "C"`],
    });
  }

  /**
   * Updates a ticket's data. Caller must have verified
   * member access via requireProjectAccess. Runs in a single transaction and
   * writes one activity row per change.
   * @param ticketID The ID of the ticket to update
   * @param projectID The ID of the project that the ticket belongs to
   * @param userID The ID of the user performing the update
   * @param data The fields to update
   * @throws HTTPException 404
   * @returns The updated ticket
   */
  static async patchTicket(
    ticketID: string,
    projectID: string,
    userID: string,
    data: {
      title?: string;
      description?: string;
      statusID?: string;
      priority?: Priority;
      assigneeID?: string | null;
      parentTicketID?: string | null;
      labelIDs?: string[];
    }
  ) {
    return await db.transaction(async (tx) => {
      const before = await this.loadSnapshot(tx, { ticketID });

      const { labelIDs, ...fields } = data;
      let ticket: typeof tickets.$inferSelect | undefined;

      if (Object.keys(fields).length) {
        [ticket] = await tx
          .update(tickets)
          .set(fields)
          .where(and(eq(tickets.id, ticketID), eq(tickets.projectID, projectID), isNull(tickets.deletedAt)))
          .returning();
        if (!ticket) throw new HTTPException(404, { message: `Ticket with id ${ticketID} not found.` });
      }

      if (labelIDs !== undefined) {
        await tx.delete(ticketLabels).where(eq(ticketLabels.ticketID, ticketID));
        if (labelIDs.length) {
          await tx.insert(ticketLabels).values(labelIDs.map((labelID) => ({ ticketID, labelID })));
        }
      }

      const after = await this.loadSnapshot(tx, { ticketID });
      await ActivityService.logUpdate(tx, userID, before, after);

      if (!ticket) {
        [ticket] = await tx.select().from(tickets).where(eq(tickets.id, ticketID));
      }
      return ticket;
    });
  }

  /**
   * Moves a ticket within a kanban column, optionally changing status.
   * Computes a new fractional-index position between the given neighbours and
   * writes an activity row when status changes.
   * @param ticketID The ID of the ticket to move
   * @param projectID The ID of the project that the ticket belongs to
   * @param userID The ID of the user performing the move (attributed on activity rows)
   * @param data The target status (optional) and neighbour ticket IDs (beforeID, afterID)
   * @throws HTTPException 404
   * @returns The updated ticket
   */
  static async moveTicket(
    ticketID: string,
    projectID: string,
    userID: string,
    data: {
      statusID?: string;
      beforeID?: string | null;
      afterID?: string | null;
    }
  ) {
    return await db.transaction(async (tx) => {
      const before = await this.loadSnapshot(tx, { ticketID });

      const [beforeNeighbour, afterNeighbour] = await Promise.all([
        data.beforeID ? tx.query.tickets.findFirst({ where: eq(tickets.id, data.beforeID), columns: { position: true } }) : null,
        data.afterID ? tx.query.tickets.findFirst({ where: eq(tickets.id, data.afterID), columns: { position: true } }) : null,
      ]);
      const newPosition = positionBetween(beforeNeighbour?.position ?? null, afterNeighbour?.position ?? null);

      const update: { position: string; statusID?: string } = { position: newPosition };
      if (data.statusID) update.statusID = data.statusID;

      const [ticket] = await tx
        .update(tickets)
        .set(update)
        .where(and(eq(tickets.id, ticketID), eq(tickets.projectID, projectID), isNull(tickets.deletedAt)))
        .returning();

      if (!ticket) throw new HTTPException(404, { message: `Ticket with id ${ticketID} not found.` });

      const after = await this.loadSnapshot(tx, { ticketID });
      await ActivityService.logUpdate(tx, userID, before, after);

      return ticket;
    });
  }

  /**
   * Soft deletes a ticket by setting `deletedAt` and writes a `deleted` activity row.
   * @param ticketID The ID of the ticket to delete
   * @param projectID The ID of the project the ticket belongs to
   * @param userID The ID of the user performing the delete (attributed on the activity row)
   * @throws HTTPException 404
   */
  static async softDeleteTicket(ticketID: string, projectID: string, userID: string) {
    await db.transaction(async (tx) => {
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
   * Hard deletes a ticket.
   * @param ticketID The ID of the ticket to delete
   * @param projectID The ID of the project the ticket belongs to
   */
  static async hardDeleteTicket(ticketID: string, projectID: string) {
    await db.delete(tickets).where(and(eq(tickets.id, ticketID), eq(tickets.projectID, projectID)));
  }

  /**
   * Restores a soft deleted ticket and writes a `restored` activity row.
   * @param ticketID The ID of the ticket to restore
   * @param projectID The ID of the project the ticket belongs to
   * @param userID The ID of the user performing the restore (attributed on the activity row)
   * @throws HTTPException 404
   * @returns The restored ticket
   */
  static async restoreTicket(ticketID: string, projectID: string, userID: string) {
    return await db.transaction(async (tx) => {
      const [ticket] = await tx
        .update(tickets)
        .set({ deletedAt: null })
        .where(and(eq(tickets.id, ticketID), eq(tickets.projectID, projectID)))
        .returning();
      if (!ticket) throw new HTTPException(404, { message: `Ticket with id ${ticketID} not found.` });

      await ActivityService.logRestore(tx, userID, ticket);
      return ticket;
    });
  }

  /**
   * Loads a {@link TicketSnapshot} from the DB or active transaction.
   * Accepts either `{ ticketID }` or `{ projectID, number }` as locator. Normalises FK
   * references to `{ id, name }` pairs so the activity differ can compare them directly
   * without a separate resolver.
   * @param handle The db or transaction to query through
   * @param locator Either the ticketID or the (projectID, number) pair
   * @returns The snapshot
   */
  static async loadSnapshot(handle: typeof db | Transaction, locator: { ticketID: string } | { projectID: string; number: number }): Promise<TicketSnapshot> {
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
        parent: { columns: { id: true, title: true } },
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
      status: { id: row.status.id, name: row.status.name },
      reporter: { id: row.reporter.id, name: row.reporter.name },
      assignee: row.assignee ? { id: row.assignee.id, name: row.assignee.name } : null,
      parent: row.parent ? { id: row.parent.id, name: row.parent.title } : null,
      labels: row.labels.map((l) => ({ id: l.label.id, name: l.label.name })),
    };
  }
}
