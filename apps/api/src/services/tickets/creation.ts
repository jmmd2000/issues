import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../../db";
import { attachments, projects, statuses, ticketActivity, ticketCounters, ticketLabels, ticketLinks, tickets } from "../../db/schema";
import { positionAfter } from "../../lib/position";
import type { Priority, Transaction } from "../../lib/types";
import { ActivityService } from "../activityService";
import { CLOSED_CATEGORIES } from "./lifecycle";
import { TicketValidation } from "./validation";

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

export class TicketCreation {
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
    return await db.transaction(tx => TicketCreation.insertTicket(tx, data));
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

      const clone = await TicketCreation.insertTicket(tx, { ...data, projectID });

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
}
