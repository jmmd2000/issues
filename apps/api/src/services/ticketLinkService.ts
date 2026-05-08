import { and, asc, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../db";
import { projects, ticketLinks, tickets } from "../db/schema";
import type { LinkType, TicketLink } from "../lib/types";
import { ActivityService } from "./activityService";

const TICKET_REF_RE = /^([A-Z]{2,6})-(\d+)$/;

type LinkRow = {
  id: string;
  linkType: LinkType;
  createdAt: Date;
  ticket: { id: string; number: number; title: string; deletedAt: Date | null };
  project: { key: string };
};

function shape(row: LinkRow, direction: "outgoing" | "incoming"): TicketLink {
  return {
    id: row.id,
    linkType: row.linkType,
    direction,
    ticket: {
      id: row.ticket.id,
      number: row.ticket.number,
      title: row.ticket.title,
      projectKey: row.project.key,
    },
    createdAt: row.createdAt.toISOString(),
  };
}

export class TicketLinkService {
  /**
   * Lists every link involving a ticket, keyed by direction. Outgoing links
   * are stored with the ticket as source; incoming are stored with another
   * ticket as source (the inverse view is computed at render time using
   * `direction`). Soft-deleted partner tickets are excluded.
   * @param ticketID The viewing ticket's ID
   * @returns Outgoing + incoming links flattened into one ordered list
   */
  static async listForTicket(ticketID: string): Promise<TicketLink[]> {
    const baseSelect = {
      id: ticketLinks.id,
      linkType: ticketLinks.linkType,
      createdAt: ticketLinks.createdAt,
      ticket: { id: tickets.id, number: tickets.number, title: tickets.title, deletedAt: tickets.deletedAt },
      project: { key: projects.key },
    } as const;

    const outgoing = await db
      .select(baseSelect)
      .from(ticketLinks)
      .innerJoin(tickets, eq(ticketLinks.targetTicketID, tickets.id))
      .innerJoin(projects, eq(tickets.projectID, projects.id))
      .where(eq(ticketLinks.sourceTicketID, ticketID))
      .orderBy(asc(ticketLinks.createdAt));

    const incoming = await db
      .select(baseSelect)
      .from(ticketLinks)
      .innerJoin(tickets, eq(ticketLinks.sourceTicketID, tickets.id))
      .innerJoin(projects, eq(tickets.projectID, projects.id))
      .where(eq(ticketLinks.targetTicketID, ticketID))
      .orderBy(asc(ticketLinks.createdAt));

    return [...outgoing.filter((row) => !row.ticket.deletedAt).map((row) => shape(row, "outgoing")), ...incoming.filter((row) => !row.ticket.deletedAt).map((row) => shape(row, "incoming"))];
  }

  /**
   * Resolves a `KEY-N` reference to a ticket row. Throws 400 if the format is
   * invalid, 404 if the project or ticket cannot be found.
   */
  static async resolveTargetRef(targetRef: string) {
    const match = targetRef.toUpperCase().trim().match(TICKET_REF_RE);
    if (!match) throw new HTTPException(400, { message: `Invalid ticket reference: ${targetRef}. Expected format: KEY-NUMBER.` });
    const [, projectKey, numberStr] = match;
    const number = Number(numberStr);

    const row = await db
      .select({ id: tickets.id, number: tickets.number, title: tickets.title, projectID: tickets.projectID, projectKey: projects.key })
      .from(tickets)
      .innerJoin(projects, eq(tickets.projectID, projects.id))
      .where(and(eq(projects.key, projectKey), eq(tickets.number, number)))
      .limit(1);

    if (!row.length || !row[0]) throw new HTTPException(404, { message: `Ticket ${targetRef} not found.` });
    return row[0];
  }

  /**
   * Creates a link involving the viewing ticket and the ticket resolved from
   * `targetRef`. When `direction` is "outgoing" the viewing ticket is stored
   * as the source; when "incoming" the partner is stored as the source so the
   * canonical row models the relationship correctly. Activity is always logged
   * on the source side. The unique constraint on (source, target, type)
   * surfaces a 409 on duplicates.
   * @param input.viewingTicketID The ticket whose detail page the user is on
   * @param input.viewingTicketRef The viewing ticket's number + title (used for incoming activity rows)
   * @param input.userID The acting user (recorded as createdBy and on the activity row)
   * @param input.targetRef Project-prefixed ticket reference, e.g. "ISSUE-42"
   * @param input.linkType One of the canonical link types
   * @param input.direction Whether the user is asserting an outgoing or inverse relationship
   * @returns The newly created link expressed from the viewing ticket's perspective
   */
  static async createLink(input: {
    viewingTicketID: string;
    viewingTicketRef: { number: number; title: string; projectKey: string };
    userID: string;
    targetRef: string;
    linkType: LinkType;
    direction: "outgoing" | "incoming";
  }): Promise<TicketLink> {
    const { viewingTicketID, viewingTicketRef, userID, targetRef, linkType, direction } = input;
    const partner = await this.resolveTargetRef(targetRef);
    if (partner.id === viewingTicketID) throw new HTTPException(400, { message: "A ticket cannot link to itself." });

    const sourceTicketID = direction === "outgoing" ? viewingTicketID : partner.id;
    const targetTicketID = direction === "outgoing" ? partner.id : viewingTicketID;
    const viewingRef = { ticketID: viewingTicketID, number: viewingTicketRef.number, title: viewingTicketRef.title, projectKey: viewingTicketRef.projectKey };
    const partnerRef = { ticketID: partner.id, number: partner.number, title: partner.title, projectKey: partner.projectKey };
    const source = direction === "outgoing" ? viewingRef : partnerRef;
    const target = direction === "outgoing" ? partnerRef : viewingRef;

    return await db.transaction(async (tx) => {
      let inserted: typeof ticketLinks.$inferSelect;
      try {
        [inserted] = await tx.insert(ticketLinks).values({ sourceTicketID, targetTicketID, linkType, createdByID: userID }).returning();
      } catch (err) {
        if (isUniqueViolation(err)) throw new HTTPException(409, { message: `Link already exists: ${targetRef} (${linkType}).` });
        throw err;
      }

      await ActivityService.logLink(tx, { userID, kind: "added", linkType, source, target });

      return {
        id: inserted.id,
        linkType,
        direction,
        ticket: { id: partner.id, number: partner.number, title: partner.title, projectKey: partner.projectKey },
        createdAt: inserted.createdAt.toISOString(),
      };
    });
  }

  /**
   * Deletes a link. Either side can request the delete (per spec) but the
   * activity row is always logged on the source ticket so the audit trail
   * stays single-sided.
   * @param linkID The link row ID
   * @param requestingTicketID The ticket the request was made from (must match source or target)
   * @param userID The acting user
   * @throws HTTPException 404 if the link does not exist or is not connected to the requesting ticket
   */
  static async deleteLink(linkID: string, requestingTicketID: string, userID: string): Promise<void> {
    await db.transaction(async (tx) => {
      const [link] = await tx
        .select({
          id: ticketLinks.id,
          sourceTicketID: ticketLinks.sourceTicketID,
          targetTicketID: ticketLinks.targetTicketID,
          linkType: ticketLinks.linkType,
        })
        .from(ticketLinks)
        .where(eq(ticketLinks.id, linkID))
        .limit(1);

      if (!link) throw new HTTPException(404, { message: `Link ${linkID} not found.` });
      if (link.sourceTicketID !== requestingTicketID && link.targetTicketID !== requestingTicketID) {
        throw new HTTPException(404, { message: `Link ${linkID} not found.` });
      }

      const sides = await tx
        .select({ id: tickets.id, number: tickets.number, title: tickets.title, projectKey: projects.key })
        .from(tickets)
        .innerJoin(projects, eq(tickets.projectID, projects.id))
        .where(inArray(tickets.id, [link.sourceTicketID, link.targetTicketID]));

      // FK cascade guarantees both sides exist while the link row exists.
      const sourceSide = sides.find((side) => side.id === link.sourceTicketID)!;
      const targetSide = sides.find((side) => side.id === link.targetTicketID)!;

      await tx.delete(ticketLinks).where(eq(ticketLinks.id, linkID));

      await ActivityService.logLink(tx, {
        userID,
        kind: "removed",
        linkType: link.linkType,
        source: { ticketID: link.sourceTicketID, number: sourceSide.number, title: sourceSide.title, projectKey: sourceSide.projectKey },
        target: { ticketID: link.targetTicketID, number: targetSide.number, title: targetSide.title, projectKey: targetSide.projectKey },
      });
    });
  }
}

/** Postgres unique-violation SQLSTATE check; walks `cause` chain because Drizzle wraps `pg` errors. */
function isUniqueViolation(err: unknown): boolean {
  let cur: unknown = err;
  while (cur && typeof cur === "object") {
    if ("code" in cur && (cur as { code: unknown }).code === "23505") return true;
    cur = "cause" in cur ? (cur as { cause: unknown }).cause : null;
  }
  return false;
}
