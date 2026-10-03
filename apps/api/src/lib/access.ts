import { and, eq, inArray, or, type SQL } from "drizzle-orm";
import { db } from "../db";
import { projectMembers, projects, tickets, users } from "../db/schema";
import { requireCondition } from "./sql";

/**
 * Access invariant for this module:
 *
 *   Anonymous viewers see public tickets in public projects.
 *   Authenticated members see everything in their projects.
 *   Service users see everything everywhere.
 *
 * Every read path that gates on project or ticket visibility should consult
 * either {@link canView} (pure predicate) or {@link visibilityWhere} (SQL
 * fragment for filtered queries) rather than re-deriving the rule inline.
 */

export type ProjectRole = "owner" | "member";

export type Role = {
  isService: boolean;
  memberships: Map<string, ProjectRole>;
};

/**
 * Loads a {@link Role} for one user. Runs the `users.isService` check and the
 * `project_members` fetch in parallel; meant to be called once per request by
 * `requireAuth` / `optionalAuth` so downstream handlers do not pay for repeat
 * lookups.
 * @param userID The authenticated user's UUID
 */
export async function loadRole(userID: string): Promise<Role> {
  const [userRows, memberRows] = await Promise.all([
    db.select({ isService: users.isService }).from(users).where(eq(users.id, userID)).limit(1),
    db.select({ projectID: projectMembers.projectID, role: projectMembers.role }).from(projectMembers).where(eq(projectMembers.userID, userID)),
  ]);

  return {
    isService: !!userRows[0]?.isService,
    memberships: new Map(memberRows.map((row) => [row.projectID, row.role])),
  };
}

/**
 * Pure visibility predicate. Returns true when the viewer described by `role`
 * is allowed to read the given `project` (and optionally `ticket`).
 *
 * Anonymous viewers (`role === undefined`) only see public projects and, when
 * a ticket is supplied, only its public tickets. Members of the project bypass
 * the visibility check entirely; service users bypass everything.
 */
export function canView(
  role: Role | undefined,
  project: { id: string; visibility: "public" | "private" },
  ticket?: { visibility: "public" | "private" }
): boolean {
  if (role?.isService) return true;
  if (role?.memberships.has(project.id)) return true;
  if (project.visibility !== "public") return false;
  if (ticket && ticket.visibility !== "public") return false;
  return true;
}

/**
 * Drizzle `where` fragment that filters a ticket-level query down to rows the
 * viewer is allowed to see. Joins must include `projects` and `tickets`.
 * Returns `undefined` for service users (no restriction).
 *
 * Anonymous viewers see only public tickets in public projects. Authed
 * non-members see the same plus everything in any project they are a member
 * of (regardless of that project's visibility).
 */
export function visibilityWhere(role: Role | undefined): SQL | undefined {
  if (role?.isService) return undefined;
  const publicClause = requireCondition(and(eq(projects.visibility, "public"), eq(tickets.visibility, "public")));
  const memberIDs = role ? Array.from(role.memberships.keys()) : [];
  if (memberIDs.length === 0) return publicClause;
  return requireCondition(or(publicClause, inArray(projects.id, memberIDs)));
}
