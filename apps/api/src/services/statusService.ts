import { and, eq, max } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../db";
import { statuses } from "../db/schema";
import { StatusCategory, Transaction } from "../lib/types";

const DEFAULT_STATUSES = [
  { name: "Backlog", slug: "backlog", category: "backlog" as const, position: 10 },
  { name: "Todo", slug: "todo", category: "backlog" as const, position: 20 },
  { name: "In Progress", slug: "in-progress", category: "active" as const, position: 10 },
  { name: "In Review", slug: "in-review", category: "active" as const, position: 20 },
  { name: "Done", slug: "done", category: "done" as const, position: 10 },
] as const;

export class StatusService {
  /**
   * Inserts default statuses for a new project
   * @param tx Active database transaction
   * @param projectID ID of the project to seed statuses for
   */
  static async seedDefaults(tx: Transaction, projectID: string) {
    await tx.insert(statuses).values(DEFAULT_STATUSES.map((status) => ({ ...status, projectID })));
  }

  /**
   * Creates a new status on a given project
   * @param name The name of the status
   * @param slug The slug of the status
   * @param category The workflow category
   * @param projectID The ID of the project this status belongs to
   * @returns The created status
   */
  static async createStatus(name: string, slug: string, category: StatusCategory, projectID: string) {
    const maxPos = await db
      .select({ max: max(statuses.position) })
      .from(statuses)
      .where(and(eq(statuses.projectID, projectID), eq(statuses.category, category)));

    const position = (maxPos[0]?.max ?? 0) + 10;

    const [status] = await db.insert(statuses).values({ name, slug, category, position, projectID }).returning();
    return status;
  }

  /**
   * Gets all statuses belonging to a given project, ordered by category and position
   * @param projectID The ID of the project
   * @returns The statuses of the project
   */
  static async getStatuses(projectID: string) {
    const projectStatuses = await db.query.statuses.findMany({
      where: eq(statuses.projectID, projectID),
      orderBy: [statuses.category, statuses.position],
    });

    return projectStatuses;
  }

  /**
   * Partially updates a status, scoped to a project. Only provided fields are written.
   * @param statusID The ID of the status to update
   * @param projectID The ID of the project
   * @param patch The fields to update
   * @returns The updated status row
   */
  static async patchStatus(statusID: string, projectID: string, patch: { name?: string; slug?: string }) {
    const [status] = await db
      .update(statuses)
      .set(patch)
      .where(and(eq(statuses.id, statusID), eq(statuses.projectID, projectID)))
      .returning();
    if (!status) throw new HTTPException(404, { message: `Status with id ${statusID} not found.` });
    return status;
  }

  /**
   * Reorders statuses in bulk. Updates position and optionally category.
   * @param projectID The ID of the project
   * @param order Array of { id, position, category? } updates
   * @returns The full updated status list
   */
  static async reorderStatuses(projectID: string, order: Array<{ id: string; position: number; category?: StatusCategory }>) {
    await db.transaction(async (tx) => {
      for (const item of order) {
        const updates: { position: number; category?: StatusCategory } = { position: item.position };
        if (item.category) updates.category = item.category;
        await tx
          .update(statuses)
          .set(updates)
          .where(and(eq(statuses.id, item.id), eq(statuses.projectID, projectID)));
      }
    });

    return this.getStatuses(projectID);
  }

  /**
   * Deletes a status, scoped to a project. Reassigns all tickets using this status to a different status.
   * @param statusID The ID of the status to delete
   * @param projectID The ID of the project
   * @param reassignToID The ID of the status to reassign tickets to
   */
  static async deleteStatus(statusID: string, projectID: string, reassignToID: string) {
    const projectStatuses = await this.getStatuses(projectID);

    if (projectStatuses.length <= 1) {
      throw new HTTPException(409, { message: "Cannot delete the last status in a project." });
    }

    const targetStatus = projectStatuses.find((s) => s.id === statusID);
    const reassignStatus = projectStatuses.find((s) => s.id === reassignToID);

    if (!targetStatus) throw new HTTPException(404, { message: `Status with id ${statusID} not found.` });
    if (!reassignStatus) throw new HTTPException(404, { message: `Status with id ${reassignToID} not found.` });

    await db.transaction(async (tx) => {
      // TODO: bulk reassign tickets when tickets table exists
      // await tx.update(tickets).set({ statusID: reassignToID }).where(eq(tickets.statusID, statusID));
      await tx.delete(statuses).where(and(eq(statuses.id, statusID), eq(statuses.projectID, projectID)));
    });
  }
}
