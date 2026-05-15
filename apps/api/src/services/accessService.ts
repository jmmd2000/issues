import { db } from "../db";
import { projectMembers, projects, users } from "../db/schema";
import { and, eq } from "drizzle-orm";

async function isServiceUser(userID: string): Promise<boolean> {
  const [row] = await db.select({ isService: users.isService }).from(users).where(eq(users.id, userID)).limit(1);
  return !!row?.isService;
}

/**
 * Subquery of project IDs the given user can access.
 * Service users see every project; humans see only projects they are members of.
 * Use as `inArray(projects.id, await accessibleProjectIDs(userID))`.
 */
export async function accessibleProjectIDs(userID: string) {
  if (await isServiceUser(userID)) {
    return db.select({ projectID: projects.id }).from(projects);
  }
  return db.select({ projectID: projectMembers.projectID }).from(projectMembers).where(eq(projectMembers.userID, userID));
}

/**
 * Returns true if the user can access the given project.
 * Service users always pass; humans must have a project_members row.
 */
export async function canAccessProject(userID: string, projectID: string): Promise<boolean> {
  if (await isServiceUser(userID)) return true;
  const [row] = await db
    .select({ projectID: projectMembers.projectID })
    .from(projectMembers)
    .where(and(eq(projectMembers.userID, userID), eq(projectMembers.projectID, projectID)))
    .limit(1);
  return !!row;
}
