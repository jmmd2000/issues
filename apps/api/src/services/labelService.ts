import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../db";
import { labels } from "../db/schema";
import { Transaction } from "../lib/types";

const DEFAULT_LABELS = [
  { name: "Bug", colour: "#e11d48" },
  { name: "Feature", colour: "#2563eb" },
  { name: "Improvement", colour: "#7c3aed" },
  { name: "Task", colour: "#059669" },
  { name: "Chore", colour: "#6b7280" },
] as const;

export class LabelService {
  /**
   * Inserts default labels for a new project
   * @param tx Active database transaction
   * @param projectID ID of the project to seed labels for
   */
  static async seedDefaults(tx: Transaction, projectID: string) {
    await tx.insert(labels).values(DEFAULT_LABELS.map((label) => ({ ...label, projectID })));
  }

  /**
   * Create a new label on a given project
   * @param name The name of the label
   * @param colour The colour for the label
   * @param projectID The ID of the project this label belongs to
   * @returns The created label
   */
  static async createLabel(name: string, colour: string, projectID: string) {
    const [label] = await db.insert(labels).values({ name, colour, projectID }).returning();
    return label;
  }
  /**
   * Gets all labels belonging to a given project
   * @param projectID The ID of the project
   * @returns The labels of the projects
   */
  static async getLabels(projectID: string) {
    const projectLabels = await db.query.labels.findMany({
      where: eq(labels.projectID, projectID),
    });

    return projectLabels;
  }

  /**
   * Updates a label's name and colour, scoped to a project
   * Caller must have verified owner access via requireProjectAccess.
   * @param labelID The ID of the label to update
   * @param projectID The ID of the project
   * @param name The new label name
   * @param colour The new label colour
   * @returns The updated label row, or undefined if no label matched
   */
  static async patchLabel(labelID: string, projectID: string, name: string, colour: string) {
    const [label] = await db
      .update(labels)
      .set({ name, colour })
      .where(and(eq(labels.id, labelID), eq(labels.projectID, projectID)))
      .returning();
    if (!label) throw new HTTPException(404, { message: `Label with id ${labelID} not found.` });
    return label;
  }

  /**
   * Deletes a label, scoped to a project
   * Caller must have verified owner access via requireProjectAccess.
   * @param labelID The ID of the label to delete
   * @param projectID The resolved project ID from middleware
   * @returns True if a label was deleted, false otherwise
   */
  static async deleteLabel(labelID: string, projectID: string) {
    const deleted = await db
      .delete(labels)
      .where(and(eq(labels.id, labelID), eq(labels.projectID, projectID)))
      .returning({ id: labels.id });
    if (deleted.length === 0) throw new HTTPException(404, { message: `Label with id ${labelID} not found.` });
  }
}
