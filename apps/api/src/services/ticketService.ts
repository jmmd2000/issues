import { and, eq, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../db";
import { ticketLabels, tickets } from "../db/schema";
import { positionBetween } from "../lib/position";
import type { Priority } from "../lib/types";
import { ActivityService } from "./activityService";
import { TicketKanban } from "./tickets/kanban";
import { TicketLifecycle } from "./tickets/lifecycle";
import { TicketSnapshots } from "./tickets/snapshot";
import { TicketValidation } from "./tickets/validation";

export class TicketService {
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
        parent: { columns: { id: true, number: true, title: true, deletedAt: true } },
        labels: { with: { label: true } },
        children: {
          columns: { id: true, number: true, title: true, priority: true, statusID: true, deletedAt: true },
          with: {
            status: { columns: { id: true, name: true, category: true } },
            assignee: { columns: { id: true, name: true, avatarURL: true } },
          },
        },
      },
    });

    if (!ticket) throw new HTTPException(404, { message: `Ticket #${number} not found` });

    const categoryRank: Record<string, number> = { backlog: 0, active: 1, done: 2, cancelled: 3 };
    const children = ticket.children
      .filter(child => !child.deletedAt)
      .map(({ deletedAt: _deletedAt, ...child }) => child)
      .sort((a, b) => {
        const rankDelta = (categoryRank[a.status.category] ?? 99) - (categoryRank[b.status.category] ?? 99);
        if (rankDelta !== 0) return rankDelta;
        return a.number - b.number;
      });

    const parent = ticket.parent && !ticket.parent.deletedAt ? { id: ticket.parent.id, number: ticket.parent.number, title: ticket.parent.title } : null;

    return {
      ...ticket,
      parent,
      labels: ticket.labels.map(({ label }) => label),
      children,
    };
  }

  /**
   * Updates a ticket's data. Caller must have verified
   * member access via requireProjectAccess. Runs in a single transaction and
   * writes one activity row per change. When the status changes, sets or
   * clears `completedAt` according to the destination category.
   * @param ticketID The ID of the ticket to update
   * @param projectID The ID of the project that the ticket belongs to
   * @param userID The ID of the user performing the update
   * @param data The fields to update
   * @throws HTTPException 400 if the status, assignee, labels or parent do not belong to the project, or the project is private and the request sets visibility
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
      visibility?: "public" | "private";
    }
  ) {
    return await db.transaction(async tx => {
      const before = await TicketSnapshots.load(tx, { ticketID });

      const { labelIDs, ...fields } = data;
      let ticket: typeof tickets.$inferSelect | undefined;

      await TicketValidation.assertVisibilityAllowed(tx, projectID, fields.visibility);
      if (fields.statusID) await TicketValidation.assertStatusInProject(tx, projectID, fields.statusID);
      if (fields.assigneeID) await TicketValidation.assertAssigneeIsMember(tx, projectID, fields.assigneeID);
      if (labelIDs) await TicketValidation.assertLabelsInProject(tx, projectID, labelIDs);

      if (fields.parentTicketID !== undefined && fields.parentTicketID !== null) {
        if (fields.parentTicketID === ticketID) {
          throw new HTTPException(400, { message: "A ticket cannot be its own parent." });
        }
        await TicketValidation.assertParentInProject(tx, projectID, fields.parentTicketID);
        await TicketValidation.assertNoParentCycle(tx, ticketID, fields.parentTicketID);
      }

      if (Object.keys(fields).length) {
        const setData: Record<string, unknown> = { ...fields };
        if (fields.statusID && fields.statusID !== before.status.id) {
          Object.assign(setData, await TicketLifecycle.completedAtUpdate(tx, fields.statusID));
        }

        [ticket] = await tx
          .update(tickets)
          .set(setData)
          .where(and(eq(tickets.id, ticketID), eq(tickets.projectID, projectID), isNull(tickets.deletedAt)))
          .returning();
        if (!ticket) throw new HTTPException(404, { message: `Ticket with id ${ticketID} not found.` });
      }

      if (labelIDs !== undefined) {
        await tx.delete(ticketLabels).where(eq(ticketLabels.ticketID, ticketID));
        if (labelIDs.length) {
          await tx.insert(ticketLabels).values(labelIDs.map(labelID => ({ ticketID, labelID })));
        }
      }

      const after = await TicketSnapshots.load(tx, { ticketID });
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
   * writes an activity row when status changes. Sets or clears `completedAt`
   * if the move crosses into or out of a closed-category status.
   * @param ticketID The ID of the ticket to move
   * @param projectID The ID of the project that the ticket belongs to
   * @param userID The ID of the user performing the move (attributed on activity rows)
   * @param data The target status (optional) and neighbour ticket IDs (beforeID, afterID)
   * @throws HTTPException 400 if the status does not belong to the project, or a neighbour is not an active ticket in the target status
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
    return await db.transaction(async tx => {
      const before = await TicketSnapshots.load(tx, { ticketID });

      if (data.statusID) await TicketValidation.assertStatusInProject(tx, projectID, data.statusID);

      const targetStatusID = data.statusID ?? before.status.id;
      const [beforePosition, afterPosition] = await Promise.all([
        TicketKanban.loadNeighbourPosition(tx, { projectID, statusID: targetStatusID, ticketID, neighbourID: data.beforeID }),
        TicketKanban.loadNeighbourPosition(tx, { projectID, statusID: targetStatusID, ticketID, neighbourID: data.afterID }),
      ]);
      const newPosition = positionBetween(beforePosition, afterPosition);

      const setData: Record<string, unknown> = { position: newPosition };
      if (data.statusID) {
        setData.statusID = data.statusID;
        if (data.statusID !== before.status.id) {
          Object.assign(setData, await TicketLifecycle.completedAtUpdate(tx, data.statusID));
        }
      }

      const [ticket] = await tx
        .update(tickets)
        .set(setData)
        .where(and(eq(tickets.id, ticketID), eq(tickets.projectID, projectID), isNull(tickets.deletedAt)))
        .returning();

      if (!ticket) throw new HTTPException(404, { message: `Ticket with id ${ticketID} not found.` });

      const after = await TicketSnapshots.load(tx, { ticketID });
      await ActivityService.logUpdate(tx, userID, before, after);

      return ticket;
    });
  }
}
