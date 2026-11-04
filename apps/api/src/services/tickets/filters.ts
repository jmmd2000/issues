import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "../../db";
import { statuses, ticketLabels, tickets, users } from "../../db/schema";
import type { Role } from "../../lib/access";
import type { Priority, Visibility } from "../../lib/types";

export const TICKET_LIST_SORT_COLUMNS = ["key", "title", "status", "priority", "assignee", "updatedAt"] as const;
export type TicketListSortColumn = (typeof TICKET_LIST_SORT_COLUMNS)[number];
export type TicketListSortDirection = "asc" | "desc";

/** How long a closed ticket stays in the default lists after it closes. */
const ARCHIVE_AFTER_DAYS = 14;

export const priorityRank = sql<number>`case ${tickets.priority}
  when 'none' then 0
  when 'low' then 1
  when 'medium' then 2
  when 'high' then 3
  when 'critical' then 4
end`;

export function buildListOrderBy(sortBy: TicketListSortColumn, sortDirection: TicketListSortDirection) {
  const order = sortDirection === "asc" ? asc : desc;
  const fallback = order(tickets.number);

  if (sortBy === "key") return [order(tickets.number)];
  if (sortBy === "title") return [order(sql`lower(${tickets.title})`), fallback];
  if (sortBy === "status") return [order(sql`lower(${statuses.name})`), fallback];
  if (sortBy === "priority") return [order(priorityRank), fallback];
  if (sortBy === "assignee") return [order(sql`coalesce(lower(${users.name}), 'unassigned')`), fallback];
  return [order(tickets.updatedAt), fallback];
}

export function archiveCutoffCondition(includeClosed: boolean): SQL | undefined {
  if (includeClosed) return undefined;
  // Cancelled tickets are always hidden unless explicitly requested. Done
  // tickets are kept while their completedAt is within the recent window.
  return and(sql`${statuses.category} != 'cancelled'`, or(sql`${statuses.category} != 'done'`, sql`${tickets.completedAt} > now() - make_interval(days => ${ARCHIVE_AFTER_DAYS})`));
}

export function statusCondition(statusID?: string[]): SQL | undefined {
  if (!statusID?.length) return undefined;
  return inArray(tickets.statusID, statusID);
}

export function priorityCondition(priority?: Priority[]): SQL | undefined {
  if (!priority?.length) return undefined;
  return inArray(tickets.priority, priority);
}

export function assigneeCondition(assigneeID?: string[]): SQL | undefined {
  if (!assigneeID?.length) return undefined;
  return inArray(tickets.assigneeID, assigneeID);
}

export function labelCondition(labelID?: string[]): SQL | undefined {
  if (!labelID?.length) return undefined;
  return inArray(tickets.id, db.select({ id: ticketLabels.ticketID }).from(ticketLabels).where(inArray(ticketLabels.labelID, labelID)));
}

export function ticketVisibilityCondition(visibility?: Visibility[]): SQL | undefined {
  if (!visibility?.length) return undefined;
  return inArray(tickets.visibility, visibility);
}

export function titleSearchCondition(titleSearch?: string): SQL | undefined {
  if (!titleSearch) return undefined;
  return ilike(tickets.title, `%${titleSearch}%`);
}

export function visibilityCondition(role: Role | undefined, projectID: string): SQL | undefined {
  if (role?.isService) return undefined;
  if (role?.memberships.has(projectID)) return undefined;
  return eq(tickets.visibility, "public");
}

export type CommonFilters = {
  statusID?: string[];
  priority?: Priority[];
  assigneeID?: string[];
  labelID?: string[];
  visibility?: Visibility[];
  titleSearch?: string;
};
