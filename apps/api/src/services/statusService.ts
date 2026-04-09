import { statuses } from "../db/schema";
import { Transaction } from "../lib/types";

const DEFAULT_STATUSES = [
  { name: "Backlog", slug: "backlog", position: 0, category: "backlog" as const },
  { name: "To Do", slug: "to_do", position: 1, category: "active" as const },
  { name: "In Progress", slug: "in_progress", position: 2, category: "active" as const },
  { name: "Done", slug: "done", position: 3, category: "done" as const },
] as const;

export class StatusService {
  /**
   * Inserts default workflow statuses for a new project
   * @param tx Active database transaction
   * @param projectID ID of the project to seed statuses for
   */
  static async seedDefaults(tx: Transaction, projectID: string) {
    await tx.insert(statuses).values(DEFAULT_STATUSES.map((status) => ({ ...status, projectID })));
  }
}
