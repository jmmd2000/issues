import { formatTicketRef, parseTicketRef } from "@issues/shared";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "../../db";
import { projects, tickets } from "../../db/schema";
import { visibilityWhere, type Role } from "../../lib/access";

/** The largest value the `number` column holds. A bigger number cannot be a real ticket. */
const MAX_TICKET_NUMBER = 2_147_483_647;

export class TicketRefs {
  /**
   * Finds which ticket refs name a ticket the viewer can see. A ref to a
   * missing, deleted or hidden ticket is left out, so the answer never shows
   * that a hidden ticket exists.
   * @param refs The refs to check, such as `DASH-12`
   * @param role The viewer's role, or `undefined` for an anonymous viewer
   * @returns The refs that exist and are visible
   */
  static async findVisible(refs: string[], role: Role | undefined): Promise<string[]> {
    const conditions = refs.flatMap(ref => {
      const parsed = parseTicketRef(ref);
      if (!parsed || parsed.number > MAX_TICKET_NUMBER) return [];
      return [and(eq(projects.key, parsed.projectKey), eq(tickets.number, parsed.number))];
    });
    if (conditions.length === 0) return [];

    const rows = await db
      .select({ key: projects.key, number: tickets.number })
      .from(tickets)
      .innerJoin(projects, eq(tickets.projectID, projects.id))
      .where(and(isNull(tickets.deletedAt), visibilityWhere(role), or(...conditions)));

    return rows.map(row => formatTicketRef(row.key, row.number));
  }
}
