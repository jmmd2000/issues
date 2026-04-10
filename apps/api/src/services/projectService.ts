import { db } from "../db";
import { eq, inArray, or } from "drizzle-orm";
import { LabelService } from "./labelService";
import { StatusService } from "./statusService";
import { projectMembers, projects, safeUserColumns } from "../db/schema";
import { HTTPException } from "hono/http-exception";

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

  /**
   * Gets all public projects for an un-authed user, additionally gets all member projects for an authed user
   * @param userID The ID of the current user, if there is one
   * @returns An array of projects
   */
  static async getAllProjects(userID: string | undefined) {
    if (userID) {
      const userProjects = db.select({ id: projectMembers.projectID }).from(projectMembers).where(eq(projectMembers.userID, userID));
      return await db
        .select()
        .from(projects)
        .where(or(eq(projects.visibility, "public"), inArray(projects.id, userProjects)));
    } else {
      return await db.select().from(projects).where(eq(projects.visibility, "public"));
    }
  }

  /**
   * Gets a specific project by its key
   * @param userID The ID of the current user, if there is one
   * @param key The key of the project to get
   * @returns A project, including it's statuses, labels and members
   */
  static async getProjectByKey(userID: string | undefined, key: string) {
    const project = await db.query.projects.findFirst({
      where: eq(projects.key, key),
      with: {
        statuses: true,
        labels: true,
        members: {
          columns: { projectID: false },
          with: { user: { columns: safeUserColumns } },
        },
      },
    });

    const notFound = new HTTPException(404, { message: `Project with key ${key} not found.` });
    if (!project) throw notFound;

    // Hide private projects from non-members behind a 404 rather than 403
    const isMember = userID && project.members.some((m) => m.userID === userID);
    if (project.visibility === "private" && !isMember) throw notFound;

    // Hide member emails from anonymous viewers of public projects
    if (!userID) {
      return {
        ...project,
        members: project.members.map((m) => ({
          ...m,
          user: {
            id: m.user.id,
            name: m.user.name,
            avatarURL: m.user.avatarURL,
            createdAt: m.user.createdAt,
            updatedAt: m.user.updatedAt,
          },
        })),
      };
    }

    return project;
  }
}
