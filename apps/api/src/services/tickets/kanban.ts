import { and, eq, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { tickets } from "../../db/schema";
import type { Transaction } from "../../lib/types";

export class TicketKanban {
  /**
   * Loads the position of a move neighbour. The neighbour must be an active
   * ticket in the project and in the status the ticket is moving to, and it
   * cannot be the ticket being moved.
   * @param tx The active transaction
   * @param locator The project, the target status, the ticket being moved and the neighbour ID from the request
   * @throws HTTPException 400
   * @returns The neighbour's position, or `null` when no neighbour was given
   */
  static async loadNeighbourPosition(tx: Transaction, locator: { projectID: string; statusID: string; ticketID: string; neighbourID?: string | null }) {
    const { projectID, statusID, ticketID, neighbourID } = locator;
    if (!neighbourID) return null;
    if (neighbourID === ticketID) {
      throw new HTTPException(400, { message: "A ticket cannot be moved relative to itself." });
    }

    const [neighbour] = await tx
      .select({ position: tickets.position })
      .from(tickets)
      .where(and(eq(tickets.id, neighbourID), eq(tickets.projectID, projectID), eq(tickets.statusID, statusID), isNull(tickets.deletedAt)))
      .limit(1);
    if (!neighbour) throw new HTTPException(400, { message: "Neighbour ticket not found in the target status." });

    return neighbour.position;
  }
}
