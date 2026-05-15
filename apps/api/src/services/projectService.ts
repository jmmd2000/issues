import { db } from "../db";
import { and, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { LabelService } from "./labelService";
import { StatusService } from "./statusService";
import { accessibleProjectIDs, canAccessProject } from "./accessService";
import { projectMembers, projects, safeUserColumns, statuses, tickets, ticketCounters } from "../db/schema";
import { HTTPException } from "hono/http-exception";

export class ProjectService {
  /**
   * Creates a new project, seeds statuses and labels, and assigns the creator as the owner
   * @param data The project fields plus the creator's userID as `ownerID`
   * @returns The created project
   */
  static async createProject(data: { key: string; name: string; description: string; visibility: "public" | "private"; repo: string | null; stack: string[]; ownerID: string }) {
    return await db.transaction(async (tx) => {
      const [project] = await tx.insert(projects).values(data).returning();
      await Promise.all([StatusService.seedDefaults(tx, project.id), LabelService.seedDefaults(tx, project.id)]);
      await tx.insert(projectMembers).values({ projectID: project.id, userID: data.ownerID, role: "owner" });
      await tx.insert(ticketCounters).values({ projectID: project.id, lastNumber: 0 });
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
      const userProjects = await accessibleProjectIDs(userID);
      return await db
        .select()
        .from(projects)
        .where(or(eq(projects.visibility, "public"), inArray(projects.id, userProjects)));
    } else {
      return await db.select().from(projects).where(eq(projects.visibility, "public"));
    }
  }

  /**
   * Lists every public project on the instance along with its count of open
   * tickets. Used by the unauthenticated homepage; deliberately limited to
   * `id`, `key`, `name`, `description`, and `openCount` so sensitive fields
   * (repo, stack, owner, timestamps) are not exposed to anonymous viewers.
   * @returns Public projects with their open ticket counts
   */
  static async getPublicProjectsWithCounts() {
    return await db
      .select({
        id: projects.id,
        key: projects.key,
        name: projects.name,
        description: projects.description,
        openCount: sql<number>`count(${tickets.id}) filter (where ${statuses.category} in ('backlog', 'active') and ${tickets.deletedAt} is null and ${tickets.visibility} = 'public')::int`,
      })
      .from(projects)
      .leftJoin(tickets, eq(tickets.projectID, projects.id))
      .leftJoin(statuses, eq(statuses.id, tickets.statusID))
      .where(eq(projects.visibility, "public"))
      .groupBy(projects.id);
  }

  /**
   * Lists every project the user can see (their own + public projects) along
   * with each project's count of open tickets. A ticket is open when its
   * status category is `backlog` or `active` and it has not been soft-deleted.
   * @param userID The current user's ID
   * @returns Project rows newest-first with an `openCount` column
   */
  static async getAllProjectsWithCounts(userID: string) {
    const memberProjects = await accessibleProjectIDs(userID);
    const memberClause = memberProjects.length ? sql`${projects.id} in (${sql.join(memberProjects.map((id) => sql`${id}`), sql`, `)})` : sql`false`;
    return await db
      .select({
        id: projects.id,
        key: projects.key,
        name: projects.name,
        description: projects.description,
        repo: projects.repo,
        stack: projects.stack,
        metadata: projects.metadata,
        visibility: projects.visibility,
        ownerID: projects.ownerID,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        openCount: sql<number>`count(${tickets.id}) filter (where ${statuses.category} in ('backlog', 'active') and ${tickets.deletedAt} is null and (${tickets.visibility} = 'public' or ${memberClause}))::int`,
      })
      .from(projects)
      .leftJoin(tickets, eq(tickets.projectID, projects.id))
      .leftJoin(statuses, eq(statuses.id, tickets.statusID))
      .where(or(eq(projects.visibility, "public"), inArray(projects.id, memberProjects)))
      .groupBy(projects.id);
  }

  /**
   * Gets a specific project by its key, enforcing visibility rules for the caller.
   * Strips member emails for anonymous viewers.
   * @param userID The ID of the current user, if there is one
   * @param key The key of the project to get
   * @returns A project, including its statuses, labels and members
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

    const hasAccess = userID ? await canAccessProject(userID, project.id) : false;
    if (project.visibility === "private" && !hasAccess) throw notFound;

    if (!userID) {
      return {
        ...project,
        members: project.members.map((member) => ({
          ...member,
          user: {
            id: member.user.id,
            name: member.user.name,
            avatarURL: member.user.avatarURL,
            createdAt: member.user.createdAt,
            updatedAt: member.user.updatedAt,
          },
        })),
      };
    }

    return project;
  }

  /**
   * Updates a project's data. Caller must have verified member access via requireProjectAccess.
   * @param projectID The resolved project ID from middleware
   * @param data The fields to update
   * @returns The updated project row
   */
  static async patchProject(
    projectID: string,
    data: {
      name: string;
      description: string;
      repo: string | null;
      stack: string[];
      metadata: Record<string, unknown>;
      visibility: "public" | "private";
    }
  ) {
    const [project] = await db.update(projects).set(data).where(eq(projects.id, projectID)).returning();
    return project;
  }

  /**
   * Deletes a project, cascading to all associated data. Caller must have verified owner access via requireProjectAccess.
   * @param projectID The resolved project ID from middleware
   */
  static async deleteProject(projectID: string) {
    await db.delete(projects).where(eq(projects.id, projectID));
  }

  /**
   * Aggregate ticket statistics for a project. Returns total / open / closed
   * counts plus per-member assigned and reported counts. Closed tickets that
   * have been soft-deleted are excluded from every count. The caller is
   * expected to have already verified project access.
   * @param projectID The resolved project ID
   * @returns Stats blob suitable for the project Overview / Members tabs
   */
  static async getStats(projectID: string, viewerCanSeePrivate: boolean) {
    const visibilityClause = viewerCanSeePrivate ? undefined : eq(tickets.visibility, "public");
    const where = and(eq(tickets.projectID, projectID), isNull(tickets.deletedAt), visibilityClause);

    const [[totals], assigneeRows, reporterRows] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)::int`,
          open: sql<number>`count(*) filter (where ${statuses.category} in ('backlog', 'active'))::int`,
          closed: sql<number>`count(*) filter (where ${statuses.category} in ('done', 'cancelled'))::int`,
          lastActivityAt: sql<string | null>`max(${tickets.updatedAt})::text`,
        })
        .from(tickets)
        .innerJoin(statuses, eq(tickets.statusID, statuses.id))
        .where(where),
      db
        .select({
          userID: tickets.assigneeID,
          open: sql<number>`count(*) filter (where ${statuses.category} in ('backlog', 'active'))::int`,
          total: sql<number>`count(*)::int`,
        })
        .from(tickets)
        .innerJoin(statuses, eq(tickets.statusID, statuses.id))
        .where(and(where, isNotNull(tickets.assigneeID)))
        .groupBy(tickets.assigneeID),
      db
        .select({
          userID: tickets.reporterID,
          reported: sql<number>`count(*)::int`,
        })
        .from(tickets)
        .where(where)
        .groupBy(tickets.reporterID),
    ]);

    const byMember: Record<string, { assignedOpen: number; assignedTotal: number; reported: number }> = {};
    for (const row of assigneeRows) {
      if (!row.userID) continue;
      byMember[row.userID] = { assignedOpen: row.open, assignedTotal: row.total, reported: 0 };
    }
    for (const row of reporterRows) {
      const existing = byMember[row.userID] ?? { assignedOpen: 0, assignedTotal: 0, reported: 0 };
      byMember[row.userID] = { ...existing, reported: row.reported };
    }

    return {
      totalTickets: totals?.total ?? 0,
      openTickets: totals?.open ?? 0,
      closedTickets: totals?.closed ?? 0,
      lastActivityAt: totals?.lastActivityAt ?? null,
      byMember,
    };
  }
}
