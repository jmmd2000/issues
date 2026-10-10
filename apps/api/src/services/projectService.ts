import { db } from "../db";
import { and, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { LabelService } from "./labelService";
import { StatusService } from "./statusService";
import { canView, type Role } from "../lib/access";
import { projectMembers, projects, safeUserColumns, statuses, tickets, ticketCounters } from "../db/schema";
import { HTTPException } from "hono/http-exception";
import type { ActivityLookup } from "../lib/types";

export class ProjectService {
  /**
   * Creates a new project, seeds statuses and labels, and assigns the creator as the owner
   * @param data The project fields plus the creator's userID as `ownerID`
   * @returns The created project
   */
  static async createProject(data: { key: string; name: string; description: string; visibility: "public" | "private"; repo: string | null; stack: string[]; ownerID: string }) {
    return await db.transaction(async tx => {
      const [project] = await tx.insert(projects).values(data).returning();
      await Promise.all([StatusService.seedDefaults(tx, project.id), LabelService.seedDefaults(tx, project.id)]);
      await tx.insert(projectMembers).values({ projectID: project.id, userID: data.ownerID, role: "owner" });
      await tx.insert(ticketCounters).values({ projectID: project.id, lastNumber: 0 });
      return project;
    });
  }

  /**
   * Gets all public projects for an un-authed user, additionally gets all
   * member projects for an authed user. Service users see every project.
   * @param role The caller's resolved role, if any
   * @returns An array of projects
   */
  static async getAllProjects(role: Role | undefined) {
    if (role?.isService) return await db.select().from(projects);
    if (!role) return await db.select().from(projects).where(eq(projects.visibility, "public"));

    const memberIDs = Array.from(role.memberships.keys());
    if (memberIDs.length === 0) return await db.select().from(projects).where(eq(projects.visibility, "public"));
    return await db
      .select()
      .from(projects)
      .where(or(eq(projects.visibility, "public"), inArray(projects.id, memberIDs)));
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
  static async getAllProjectsWithCounts(role: Role) {
    if (role.isService) {
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
          openCount: sql<number>`count(${tickets.id}) filter (where ${statuses.category} in ('backlog', 'active') and ${tickets.deletedAt} is null)::int`,
        })
        .from(projects)
        .leftJoin(tickets, eq(tickets.projectID, projects.id))
        .leftJoin(statuses, eq(statuses.id, tickets.statusID))
        .groupBy(projects.id);
    }

    const memberProjects = Array.from(role.memberships.keys());
    const memberClause = memberProjects.length
      ? sql`${projects.id} in (${sql.join(
          memberProjects.map(id => sql`${id}`),
          sql`, `
        )})`
      : sql`false`;
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
      .where(memberProjects.length ? or(eq(projects.visibility, "public"), inArray(projects.id, memberProjects)) : eq(projects.visibility, "public"))
      .groupBy(projects.id);
  }

  /**
   * Gets a specific project by its key, enforcing visibility rules for the caller.
   * Strips member emails for anonymous viewers.
   * @param role The caller's resolved role, if any
   * @param key The key of the project to get
   * @returns A project, including its statuses, labels and members
   */
  static async getProjectByKey(role: Role | undefined, key: string) {
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
    if (!canView(role, project)) throw notFound;

    if (!role) {
      return {
        ...project,
        members: project.members.map(member => ({
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
   * Gets the statuses, labels and members that activity cards need for each
   * project, keyed by project key. Only the fields used for colours and
   * avatars are returned. The caller must only pass keys for projects the
   * viewer can already see.
   * @param keys The keys of the projects to look up
   * @returns A lookup for each project found, keyed by project key
   */
  static async getActivityLookups(keys: string[]): Promise<Record<string, ActivityLookup>> {
    if (keys.length === 0) return {};

    const rows = await db.query.projects.findMany({
      where: inArray(projects.key, keys),
      columns: { key: true },
      with: {
        statuses: { columns: { id: true, category: true } },
        labels: { columns: { id: true, colour: true } },
        members: { columns: {}, with: { user: { columns: { id: true, avatarURL: true } } } },
      },
    });

    const lookups: Record<string, ActivityLookup> = {};
    for (const row of rows) {
      lookups[row.key] = { statuses: row.statuses, labels: row.labels, members: row.members };
    }
    return lookups;
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
  static async getStats(projectID: string, role: Role | undefined) {
    const memberOrService = role?.isService || !!role?.memberships.has(projectID);
    const visibilityClause = memberOrService ? undefined : eq(tickets.visibility, "public");
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
