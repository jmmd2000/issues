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
}
