import { db } from "../db";
import { projectMembers, projects } from "../db/schema";
import { LabelService } from "./labelService";
import { StatusService } from "./statusService";

export class ProjectService {
  /**
   * Creates a new project, seeds statuses and labels, and assigns the creator as the owner
   * @param key The key for the project, used in ticket references etc.
   * @param name The project's name
   * @param description The project's description
   * @param visibility `public` or `private`
   * @param ownerID The ID of the user that created this project
   * @returns The created project
   */
  static async createProject(key: string, name: string, description: string, visibility: "public" | "private", ownerID: string) {
    return await db.transaction(async (tx) => {
      const [project] = await tx.insert(projects).values({ key, name, description, visibility, ownerID }).returning();
      await Promise.all([StatusService.seedDefaults(tx, project.id), LabelService.seedDefaults(tx, project.id)]);
      await tx.insert(projectMembers).values({ projectID: project.id, userID: ownerID, role: "owner" });
      return project;
    });
  }
}
