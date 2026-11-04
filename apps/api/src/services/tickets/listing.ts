import { and, desc, eq, isNotNull, isNull, notInArray, sql } from "drizzle-orm";
import { db } from "../../db";
import { statuses, tickets, users } from "../../db/schema";
import type { Role } from "../../lib/access";
import {
  archiveCutoffCondition,
  assigneeCondition,
  buildListOrderBy,
  labelCondition,
  priorityCondition,
  priorityRank,
  statusCondition,
  ticketVisibilityCondition,
  titleSearchCondition,
  visibilityCondition,
  type CommonFilters,
  type TicketListSortColumn,
  type TicketListSortDirection,
} from "./filters";

export class TicketListing {
  /**
   * Lists tickets for a project with optional filters. Excludes soft-deleted tickets.
   * Hides tickets whose status is `done` or `cancelled` and whose `completedAt` is older
   * than the archive window unless `includeClosed` is true.
   * @param projectID The ID of the project
   * @param filters Optional filters, pagination, and sorting
   */
  static async listForProject(
    projectID: string,
    filters: CommonFilters & {
      includeClosed?: boolean;
      page?: number;
      perPage?: number;
      sortBy?: TicketListSortColumn;
      sortDirection?: TicketListSortDirection;
    },
    role: Role | undefined
  ) {
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 25;
    const sortBy = filters.sortBy ?? "updatedAt";
    const sortDirection = filters.sortDirection ?? "desc";

    const where = and(
      eq(tickets.projectID, projectID),
      isNull(tickets.deletedAt),
      visibilityCondition(role, projectID),
      statusCondition(filters.statusID),
      titleSearchCondition(filters.titleSearch),
      priorityCondition(filters.priority),
      assigneeCondition(filters.assigneeID),
      labelCondition(filters.labelID),
      ticketVisibilityCondition(filters.visibility),
      archiveCutoffCondition(filters.includeClosed ?? false)
    );

    const [rows, totalRow] = await Promise.all([
      db
        .select({ ticket: tickets })
        .from(tickets)
        .innerJoin(statuses, eq(tickets.statusID, statuses.id))
        .leftJoin(users, eq(tickets.assigneeID, users.id))
        .where(where)
        .orderBy(...buildListOrderBy(sortBy, sortDirection))
        .limit(perPage)
        .offset((page - 1) * perPage),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(tickets)
        .innerJoin(statuses, eq(tickets.statusID, statuses.id))
        .where(where),
    ]);

    return { tickets: rows.map(({ ticket }) => ticket), total: totalRow[0]?.total ?? 0 };
  }

  /**
   * Lists the active kanban board for a project. Backlog statuses are excluded
   * by default; closed tickets older than the archive window are
   * also excluded unless `includeClosed` is true. Excludes soft-deleted tickets.
   * @param projectID The ID of the project
   * @param filters Optional board filters
   */
  static async listBoardForProject(
    projectID: string,
    filters: CommonFilters & {
      includeClosed?: boolean;
    },
    role: Role | undefined
  ) {
    const where = and(
      eq(tickets.projectID, projectID),
      isNull(tickets.deletedAt),
      visibilityCondition(role, projectID),
      notInArray(statuses.category, ["backlog"]),
      statusCondition(filters.statusID),
      titleSearchCondition(filters.titleSearch),
      priorityCondition(filters.priority),
      assigneeCondition(filters.assigneeID),
      labelCondition(filters.labelID),
      ticketVisibilityCondition(filters.visibility),
      archiveCutoffCondition(filters.includeClosed ?? false)
    );

    const rows = await db
      .select({ ticket: tickets })
      .from(tickets)
      .innerJoin(statuses, eq(tickets.statusID, statuses.id))
      .where(where)
      .orderBy(tickets.statusID, sql`${tickets.position} COLLATE "C"`);

    return rows.map(({ ticket }) => ticket);
  }

  /**
   * Lists soft-deleted tickets for a project, newest deletions first by default.
   * Reuses the same filter + sort plumbing as {@link listForProject} but
   * inverts the deletion predicate and skips the archive cutoff (the trash
   * has no notion of "stale closed work" -- everything in here is explicitly
   * pending a hard delete or restore).
   * @param projectID The project to list trash for
   * @param filters Optional filters, pagination, and sorting
   */
  static async listTrashForProject(
    projectID: string,
    filters: CommonFilters & {
      page?: number;
      perPage?: number;
      sortBy?: TicketListSortColumn;
      sortDirection?: TicketListSortDirection;
    }
  ) {
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 25;
    const sortBy = filters.sortBy ?? "updatedAt";
    const sortDirection = filters.sortDirection ?? "desc";

    const where = and(
      eq(tickets.projectID, projectID),
      isNotNull(tickets.deletedAt),
      statusCondition(filters.statusID),
      titleSearchCondition(filters.titleSearch),
      priorityCondition(filters.priority),
      assigneeCondition(filters.assigneeID),
      labelCondition(filters.labelID),
      ticketVisibilityCondition(filters.visibility)
    );

    const [rows, totalRow] = await Promise.all([
      db
        .select({ ticket: tickets })
        .from(tickets)
        .innerJoin(statuses, eq(tickets.statusID, statuses.id))
        .leftJoin(users, eq(tickets.assigneeID, users.id))
        .where(where)
        .orderBy(...buildListOrderBy(sortBy, sortDirection))
        .limit(perPage)
        .offset((page - 1) * perPage),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(tickets)
        .innerJoin(statuses, eq(tickets.statusID, statuses.id))
        .where(where),
    ]);

    return { tickets: rows.map(({ ticket }) => ticket), total: totalRow[0]?.total ?? 0 };
  }

  /**
   * Lists tickets in backlog statuses for a project, sorted by priority (desc)
   * then creation time (desc). Excludes soft-deleted tickets. Used by the
   * kanban backlog drawer.
   * @param projectID The ID of the project
   * @param filters Optional filters
   */
  static async listBacklogForProject(projectID: string, filters: CommonFilters, role: Role | undefined) {
    const where = and(
      eq(tickets.projectID, projectID),
      isNull(tickets.deletedAt),
      visibilityCondition(role, projectID),
      eq(statuses.category, "backlog"),
      titleSearchCondition(filters.titleSearch),
      priorityCondition(filters.priority),
      assigneeCondition(filters.assigneeID),
      labelCondition(filters.labelID),
      ticketVisibilityCondition(filters.visibility)
    );

    const rows = await db.select({ ticket: tickets }).from(tickets).innerJoin(statuses, eq(tickets.statusID, statuses.id)).where(where).orderBy(desc(priorityRank), desc(tickets.createdAt));

    return rows.map(({ ticket }) => ticket);
  }
}
