import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../db";
import { attachments, projects, statuses, ticketActivity, ticketLinks, tickets, ticketCounters, ticketLabels } from "../db/schema";
import { positionAfter, positionBetween } from "../lib/position";
import type { Priority, Transaction } from "../lib/types";
import { ActivityService } from "./activityService";
import { TicketKanban } from "./tickets/kanban";
import { CLOSED_CATEGORIES, TicketLifecycle } from "./tickets/lifecycle";
import { TicketSnapshots } from "./tickets/snapshot";
import { TicketValidation } from "./tickets/validation";

export type TicketCreateInput = {
  projectID: string;
  reporterID: string;
  title: string;
  description?: string;
  statusID: string;
  priority?: Priority;
  assigneeID?: string;
  labelIDs?: string[];
  parentTicketID?: string;
  visibility?: "public" | "private";
};

export class TicketService {
  /**
   * Create a ticket in a project. Increments the project's ticket counter,
   * attaches any labels, and writes a `created` activity row. All work runs in
   * a single transaction.
   * @param data The ticket fields plus `projectID` and `reporterID` from the route.
   * @throws HTTPException 400 if the status, assignee, labels or parent do not belong to the project, or the project is private and the request sets visibility
   * @throws HTTPException 500
   * @returns The created ticket
   */
  static async createTicket(data: TicketCreateInput) {
    return await db.transaction(tx => this.insertTicket(tx, data));
  }

  /**
   * Internal helper that performs the counter bump, insert, label attach, and
   * `created` activity write on the supplied transaction. Shared between the
   * top-level `createTicket` route handler path and `cloneTicket`, which adds
   * link + activity rows on the same transaction so a clone is atomic.
   */
  private static async insertTicket(tx: Transaction, data: TicketCreateInput) {
    await TicketValidation.assertVisibilityAllowed(tx, data.projectID, data.visibility);
    await TicketValidation.assertStatusInProject(tx, data.projectID, data.statusID);
    if (data.assigneeID) await TicketValidation.assertAssigneeIsMember(tx, data.projectID, data.assigneeID);
    if (data.labelIDs) await TicketValidation.assertLabelsInProject(tx, data.projectID, data.labelIDs);
    if (data.parentTicketID) await TicketValidation.assertParentInProject(tx, data.projectID, data.parentTicketID);

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

    const [status] = await tx.select({ category: statuses.category }).from(statuses).where(eq(statuses.id, data.statusID)).limit(1);
    const isClosed = status ? CLOSED_CATEGORIES.includes(status.category) : false;

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
        visibility: data.visibility ?? "public",
        completedAt: isClosed ? new Date() : null,
      })
      .returning();

    if (data.labelIDs?.length) {
      await tx.insert(ticketLabels).values(data.labelIDs.map(labelID => ({ ticketID: ticket.id, labelID })));
    }

    await ActivityService.logCreate(tx, data.reporterID, ticket);

    return ticket;
  }

  /**
   * Clones a source ticket into a new ticket in the same project. The new
   * ticket's fields come from `data` (the user's edits to the prefilled
   * form). When `copyAttachments` is true, every attachment row on the source
   * is duplicated against the clone -- the underlying storage_key is reused
   * via Postgres FK, so the bytes are not re-uploaded. A `clones` link is
   * always inserted from source to clone, and a `cloned_from` activity row is
   * always emitted on the clone. The `link_added` audit pair is emitted on
   * both sides via {@link ActivityService.logLink}, matching the manual-link
   * flow.
   * @throws HTTPException 404 if the source is missing or soft-deleted
   * @returns The new clone ticket
   */
  static async cloneTicket(sourceID: string, projectID: string, userID: string, data: TicketCreateInput & { copyAttachments?: boolean }) {
    return await db.transaction(async tx => {
      const source = await tx.query.tickets.findFirst({
        where: and(eq(tickets.id, sourceID), eq(tickets.projectID, projectID), isNull(tickets.deletedAt)),
        columns: { id: true, number: true, title: true, projectID: true },
      });
      if (!source) throw new HTTPException(404, { message: `Source ticket ${sourceID} not found.` });

      const clone = await this.insertTicket(tx, { ...data, projectID });

      if (data.copyAttachments) {
        const sourceAttachments = await tx
          .select({
            uploaderID: attachments.uploaderID,
            filename: attachments.filename,
            storageKey: attachments.storageKey,
            contentHash: attachments.contentHash,
            sizeBytes: attachments.sizeBytes,
            width: attachments.width,
            height: attachments.height,
            mimeType: attachments.mimeType,
            isImage: attachments.isImage,
          })
          .from(attachments)
          .where(eq(attachments.ticketID, sourceID));

        if (sourceAttachments.length) {
          await tx.insert(attachments).values(sourceAttachments.map(row => ({ ...row, ticketID: clone.id, commentID: null, uploaderID: userID })));
        }
      }

      const [project] = await tx.select({ key: projects.key }).from(projects).where(eq(projects.id, projectID)).limit(1);
      const projectKey = project?.key ?? "";

      // The clone is the link's source ("clones X"), the original is the
      // target ("is cloned by Y") -- this matches how a reader expects to read
      // the relationship from either side.
      await tx.insert(ticketLinks).values({ sourceTicketID: clone.id, targetTicketID: source.id, linkType: "clones", createdByID: userID });

      await tx.insert(ticketActivity).values({
        ticketID: clone.id,
        projectID,
        userID,
        action: "cloned_from",
        fieldName: null,
        oldValue: null,
        newValue: { id: source.id, number: source.number, title: source.title, projectKey },
      });

      await ActivityService.logLink(tx, {
        userID,
        kind: "added",
        linkType: "clones",
        source: { ticketID: clone.id, number: clone.number, title: clone.title, projectKey },
        target: { ticketID: source.id, number: source.number, title: source.title, projectKey },
      });

      return clone;
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
