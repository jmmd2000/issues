import { and, eq, inArray, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { labels, projectMembers, projects, statuses, tickets } from "../../db/schema";
import type { Transaction } from "../../lib/types";

/** The checks a ticket's fields must pass before a write. Each throws HTTPException 400 when a check fails. */
export class TicketValidation {
  /**
   * Walks up the proposed parent's ancestor chain. Throws 400 if `ticketID`
   * (the ticket being patched) appears anywhere above the proposed parent --
   * setting that parent would form a cycle. Bounded by tree depth, with a
   * hard cap on hops as a safety net against malformed data.
   * @param tx Active transaction
   * @param ticketID The ticket whose parent is being changed
   * @param proposedParentID The candidate new parent
   */
  static async assertNoParentCycle(tx: Transaction, ticketID: string, proposedParentID: string) {
    const MAX_DEPTH = 100;
    let cursor: string | null = proposedParentID;
    for (let depth = 0; depth < MAX_DEPTH && cursor; depth += 1) {
      if (cursor === ticketID) {
        throw new HTTPException(400, { message: "Setting this parent would create a cycle." });
      }
      const [row] = await tx.select({ parentTicketID: tickets.parentTicketID }).from(tickets).where(eq(tickets.id, cursor)).limit(1);
      if (!row) return;
      cursor = row.parentTicketID;
    }
  }

  /**
   * Checks that a request may set a ticket's visibility. Every ticket in a
   * private project is already hidden, so the project refuses any visibility
   * value. A request that leaves visibility out is always valid.
   * @param tx The active transaction
   * @param projectID The project the ticket belongs to
   * @param visibility The visibility from the request, if any
   * @throws HTTPException 400 if the project is private and the request sets visibility
   */
  static async assertVisibilityAllowed(tx: Transaction, projectID: string, visibility: "public" | "private" | undefined) {
    if (visibility === undefined) return;
    const [project] = await tx.select({ visibility: projects.visibility }).from(projects).where(eq(projects.id, projectID)).limit(1);
    if (project?.visibility === "private") {
      throw new HTTPException(400, { message: "Ticket visibility cannot be set in a private project." });
    }
  }

  /**
   * Checks that a status belongs to the project.
   * @param tx The active transaction
   * @param projectID The project the ticket belongs to
   * @param statusID The status ID from the request
   * @throws HTTPException 400
   */
  static async assertStatusInProject(tx: Transaction, projectID: string, statusID: string) {
    const [status] = await tx
      .select({ id: statuses.id })
      .from(statuses)
      .where(and(eq(statuses.id, statusID), eq(statuses.projectID, projectID)))
      .limit(1);
    if (!status) throw new HTTPException(400, { message: "Status not found in this project." });
  }

  /**
   * Checks that every label belongs to the project and that no label ID is
   * repeated. An empty list is valid.
   * @param tx The active transaction
   * @param projectID The project the ticket belongs to
   * @param labelIDs The label IDs from the request
   * @throws HTTPException 400
   */
  static async assertLabelsInProject(tx: Transaction, projectID: string, labelIDs: string[]) {
    if (!labelIDs.length) return;
    if (new Set(labelIDs).size !== labelIDs.length) {
      throw new HTTPException(400, { message: "Label IDs must be unique." });
    }
    const found = await tx
      .select({ id: labels.id })
      .from(labels)
      .where(and(inArray(labels.id, labelIDs), eq(labels.projectID, projectID)));
    if (found.length !== labelIDs.length) {
      throw new HTTPException(400, { message: "One or more labels not found in this project." });
    }
  }

  /**
   * Checks that the assignee is a member of the project.
   * @param tx The active transaction
   * @param projectID The project the ticket belongs to
   * @param assigneeID The user ID from the request
   * @throws HTTPException 400
   */
  static async assertAssigneeIsMember(tx: Transaction, projectID: string, assigneeID: string) {
    const [member] = await tx
      .select({ userID: projectMembers.userID })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectID, projectID), eq(projectMembers.userID, assigneeID)))
      .limit(1);
    if (!member) throw new HTTPException(400, { message: "Assignee is not a member of this project." });
  }

  /**
   * Checks that the parent ticket exists in the project and is not deleted.
   * @param tx The active transaction
   * @param projectID The project the ticket belongs to
   * @param parentTicketID The parent ticket ID from the request
   * @throws HTTPException 400
   */
  static async assertParentInProject(tx: Transaction, projectID: string, parentTicketID: string) {
    const [parent] = await tx
      .select({ id: tickets.id })
      .from(tickets)
      .where(and(eq(tickets.id, parentTicketID), eq(tickets.projectID, projectID), isNull(tickets.deletedAt)))
      .limit(1);
    if (!parent) throw new HTTPException(400, { message: "Parent ticket not found in this project." });
  }
}
