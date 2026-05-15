import { and, asc, desc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { labels as labelsTable, projectMembers, projects, statuses, ticketLabels, tickets, users } from "../db/schema";
import { accessibleProjectIDs } from "./accessService";
import { STATUS_CATEGORIES } from "../lib/constants";
import type { Priority, SearchFilterOptions, SearchHighlightPart, SearchResult, SearchSortColumn, SearchSortDirection } from "../lib/types";

const HIGHLIGHT_START = "[[issues-highlight-start]]";
const HIGHLIGHT_END = "[[issues-highlight-end]]";
const HEADLINE_OPTIONS = `StartSel=${HIGHLIGHT_START}, StopSel=${HIGHLIGHT_END}, MaxWords=35, MinWords=8, MaxFragments=2, FragmentDelimiter=...`;
const DESCRIPTION_PREVIEW_LENGTH = 260;

export type SearchParams = {
  q?: string;
  projectKey?: string;
  statusSlugs?: string[];
  priorities?: Priority[];
  labelNames?: string[];
  assigneeIDs?: string[];
  page?: number;
  perPage?: number;
  sortBy?: SearchSortColumn;
  sortDirection?: SearchSortDirection;
};

type SearchRow = {
  id: string;
  number: number;
  title: string;
  description: string;
  priority: Priority;
  visibility: "public" | "private";
  createdAt: Date;
  updatedAt: Date;
  project: { id: string; key: string; name: string; visibility: "public" | "private" };
  status: { id: string; name: string; slug: string; category: SearchResult["status"]["category"] };
  assignee: { id: string; name: string; avatarURL: string | null } | null;
  titleHeadline: string;
  descriptionHeadline: string;
};

type LabelRow = {
  ticketID: string;
  label: { id: string; name: string; colour: string };
};

async function projectVisibilityCondition(userID?: string): Promise<SQL> {
  if (!userID) return eq(projects.visibility, "public");
  return or(eq(projects.visibility, "public"), inArray(projects.id, await accessibleProjectIDs(userID)))!;
}

async function ticketVisibilityCondition(userID?: string): Promise<SQL> {
  if (!userID) return and(eq(projects.visibility, "public"), eq(tickets.visibility, "public"))!;
  return or(inArray(tickets.projectID, await accessibleProjectIDs(userID)), and(eq(projects.visibility, "public"), eq(tickets.visibility, "public")))!;
}

function projectKeyCondition(projectKey?: string): SQL | undefined {
  if (!projectKey) return undefined;
  return eq(projects.key, projectKey.toUpperCase());
}

function textSearchCondition(query?: string): SQL | undefined {
  if (!query) return undefined;
  return sql`${tickets.descriptionSearch} @@ websearch_to_tsquery('english', ${query})`;
}

function statusCondition(statusSlugs?: string[]): SQL | undefined {
  if (!statusSlugs?.length) return undefined;
  return inArray(statuses.slug, statusSlugs);
}

function priorityCondition(priorities?: Priority[]): SQL | undefined {
  if (!priorities?.length) return undefined;
  return inArray(tickets.priority, priorities);
}

function assigneeCondition(assigneeIDs?: string[]): SQL | undefined {
  if (!assigneeIDs?.length) return undefined;
  return inArray(tickets.assigneeID, assigneeIDs);
}

function labelCondition(labelNames?: string[]): SQL | undefined {
  if (!labelNames?.length) return undefined;
  const matchingTickets = db
    .select({ id: ticketLabels.ticketID })
    .from(ticketLabels)
    .innerJoin(labelsTable, eq(ticketLabels.labelID, labelsTable.id))
    .where(inArray(labelsTable.name, labelNames));
  return inArray(tickets.id, matchingTickets);
}

function excerptDescription(description: string): string {
  const normalised = description.replace(/\s+/g, " ").trim();
  if (normalised.length <= DESCRIPTION_PREVIEW_LENGTH) return normalised;

  const clipped = normalised.slice(0, DESCRIPTION_PREVIEW_LENGTH).trimEnd();
  const lastSpace = clipped.lastIndexOf(" ");
  const boundary = lastSpace > DESCRIPTION_PREVIEW_LENGTH * 0.6 ? lastSpace : clipped.length;
  return `${clipped.slice(0, boundary)}...`;
}

function parseHighlightParts(value: string): SearchHighlightPart[] {
  if (!value) return [];

  const parts: SearchHighlightPart[] = [];
  let cursor = 0;

  while (cursor < value.length) {
    const start = value.indexOf(HIGHLIGHT_START, cursor);
    if (start === -1) {
      parts.push({ text: value.slice(cursor), highlighted: false });
      break;
    }

    if (start > cursor) {
      parts.push({ text: value.slice(cursor, start), highlighted: false });
    }

    const textStart = start + HIGHLIGHT_START.length;
    const end = value.indexOf(HIGHLIGHT_END, textStart);
    if (end === -1) {
      parts.push({ text: value.slice(start), highlighted: false });
      break;
    }

    parts.push({ text: value.slice(textStart, end), highlighted: true });
    cursor = end + HIGHLIGHT_END.length;
  }

  return parts.filter((part) => part.text.length > 0);
}

function orderLabelsByName(rows: LabelRow[]): Map<string, SearchResult["labels"]> {
  const labelsByTicketID = new Map<string, SearchResult["labels"]>();
  for (const row of rows) {
    const existing = labelsByTicketID.get(row.ticketID) ?? [];
    existing.push(row.label);
    labelsByTicketID.set(row.ticketID, existing);
  }

  for (const labels of labelsByTicketID.values()) {
    labels.sort((a, b) => a.name.localeCompare(b.name));
  }

  return labelsByTicketID;
}

function shapeResult(row: SearchRow, labels: SearchResult["labels"], hasQuery: boolean): SearchResult {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    description: row.description,
    priority: row.priority,
    visibility: row.visibility,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    project: row.project,
    status: row.status,
    assignee: row.assignee ? { id: row.assignee.id, name: row.assignee.name, avatarURL: row.assignee.avatarURL } : null,
    labels,
    highlights: {
      title: parseHighlightParts(hasQuery ? row.titleHeadline : row.title),
      description: parseHighlightParts(hasQuery ? row.descriptionHeadline : excerptDescription(row.description)),
    },
  };
}

function uniqueBy<T>(rows: T[], key: (row: T) => string): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const row of rows) {
    const value = key(row);
    if (seen.has(value)) continue;
    seen.add(value);
    unique.push(row);
  }
  return unique;
}

function defaultSearchSortColumn(query: string | undefined, sortBy: SearchSortColumn | undefined): SearchSortColumn {
  return sortBy ?? (query ? "relevance" : "updatedAt");
}

function defaultSearchSortDirection(sortBy: SearchSortColumn, sortDirection: SearchSortDirection | undefined): SearchSortDirection {
  return sortDirection ?? (sortBy === "title" ? "asc" : "desc");
}

function buildSearchOrderBy(sortBy: SearchSortColumn, sortDirection: SearchSortDirection, rank: SQL<number>, hasQuery: boolean): SQL[] {
  const order = sortDirection === "asc" ? asc : desc;
  const fallback = [asc(projects.key), desc(tickets.number)];

  if (sortBy === "relevance") {
    return hasQuery ? [order(rank), desc(tickets.updatedAt), ...fallback] : [desc(tickets.updatedAt), ...fallback];
  }
  if (sortBy === "title") return [order(sql`lower(${tickets.title})`), ...fallback];
  if (sortBy === "createdAt") return [order(tickets.createdAt), ...fallback];
  return [order(tickets.updatedAt), ...fallback];
}

export class SearchService {
  /**
   * Searches visible tickets with optional full-text and structured filters.
   * Text matching uses Postgres FTS (`websearch_to_tsquery`) and returns
   * pre-split highlight parts generated from `ts_headline`.
   * @param params Query text, filters, and pagination
   * @param userID Optional current user ID, used to include member projects
   * @returns Paginated ticket results and `hasNextPage`
   */
  static async search(params: SearchParams, userID?: string): Promise<{ tickets: SearchResult[]; total: number; page: number; perPage: number; hasNextPage: boolean }> {
    const query = params.q?.trim() || undefined;
    const page = params.page ?? 1;
    const perPage = params.perPage ?? 25;
    const sortBy = defaultSearchSortColumn(query, params.sortBy);
    const sortDirection = defaultSearchSortDirection(sortBy, params.sortDirection);
    const rank = query ? sql<number>`ts_rank(${tickets.descriptionSearch}, websearch_to_tsquery('english', ${query}))` : sql<number>`0`;
    const titleHeadline = query ? sql<string>`ts_headline('english', ${tickets.title}, websearch_to_tsquery('english', ${query}), ${HEADLINE_OPTIONS})` : tickets.title;
    const descriptionHeadline = query
      ? sql<string>`ts_headline('english', ${tickets.description}, websearch_to_tsquery('english', ${query}), ${HEADLINE_OPTIONS})`
      : tickets.description;

    const where = and(
      isNull(tickets.deletedAt),
      await ticketVisibilityCondition(userID),
      projectKeyCondition(params.projectKey),
      textSearchCondition(query),
      statusCondition(params.statusSlugs),
      priorityCondition(params.priorities),
      assigneeCondition(params.assigneeIDs),
      labelCondition(params.labelNames)
    );

    const orderBy = buildSearchOrderBy(sortBy, sortDirection, rank, Boolean(query));
    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: tickets.id,
          number: tickets.number,
          title: tickets.title,
          description: tickets.description,
          priority: tickets.priority,
          visibility: tickets.visibility,
          createdAt: tickets.createdAt,
          updatedAt: tickets.updatedAt,
          project: { id: projects.id, key: projects.key, name: projects.name, visibility: projects.visibility },
          status: { id: statuses.id, name: statuses.name, slug: statuses.slug, category: statuses.category },
          assignee: { id: users.id, name: users.name, avatarURL: users.avatarURL },
          titleHeadline,
          descriptionHeadline,
        })
        .from(tickets)
        .innerJoin(projects, eq(tickets.projectID, projects.id))
        .innerJoin(statuses, eq(tickets.statusID, statuses.id))
        .leftJoin(users, eq(tickets.assigneeID, users.id))
        .where(where)
        .orderBy(...orderBy)
        .limit(perPage + 1)
        .offset((page - 1) * perPage),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(tickets)
        .innerJoin(projects, eq(tickets.projectID, projects.id))
        .innerJoin(statuses, eq(tickets.statusID, statuses.id))
        .where(where),
    ]);

    const pageRows = rows.slice(0, perPage);
    const ticketIDs = pageRows.map((row) => row.id);
    const labelRows = ticketIDs.length
      ? await db
          .select({
            ticketID: ticketLabels.ticketID,
            label: { id: labelsTable.id, name: labelsTable.name, colour: labelsTable.colour },
          })
          .from(ticketLabels)
          .innerJoin(labelsTable, eq(ticketLabels.labelID, labelsTable.id))
          .where(inArray(ticketLabels.ticketID, ticketIDs))
      : [];

    const labelsByTicketID = orderLabelsByName(labelRows);
    return {
      tickets: pageRows.map((row) => shapeResult(row, labelsByTicketID.get(row.id) ?? [], Boolean(query))),
      total,
      page,
      perPage,
      hasNextPage: rows.length > perPage,
    };
  }

  /**
   * Lists URL-stable filter choices across projects visible to the caller.
   * When `projectKey` is provided, options are scoped to that project.
   * @param userID Optional current user ID, used to include member projects
   * @param projectKey Optional project key lock
   * @returns Projects, status slugs, label names, and assignees
   */
  static async listFilterOptions(userID?: string, projectKey?: string): Promise<SearchFilterOptions> {
    const where = and(await projectVisibilityCondition(userID), projectKeyCondition(projectKey));

    const [projectRows, statusRows, labelRows, memberRows] = await Promise.all([
      db
        .select({ id: projects.id, key: projects.key, name: projects.name, visibility: projects.visibility })
        .from(projects)
        .where(where)
        .orderBy(asc(projects.key)),
      db
        .select({ slug: statuses.slug, name: statuses.name, category: statuses.category })
        .from(statuses)
        .innerJoin(projects, eq(statuses.projectID, projects.id))
        .where(where)
        .orderBy(asc(statuses.slug)),
      db
        .select({ name: labelsTable.name, colour: labelsTable.colour })
        .from(labelsTable)
        .innerJoin(projects, eq(labelsTable.projectID, projects.id))
        .where(where)
        .orderBy(asc(labelsTable.name)),
      db
        .select({ id: users.id, name: users.name, avatarURL: users.avatarURL })
        .from(projectMembers)
        .innerJoin(projects, eq(projectMembers.projectID, projects.id))
        .innerJoin(users, eq(projectMembers.userID, users.id))
        .where(where)
        .orderBy(asc(users.name)),
    ]);

    return {
      projects: projectRows,
      statuses: uniqueBy(statusRows, (row) => row.slug).sort(
        (a, b) => STATUS_CATEGORIES.indexOf(a.category) - STATUS_CATEGORIES.indexOf(b.category) || a.name.localeCompare(b.name)
      ),
      labels: uniqueBy(labelRows, (row) => row.name).sort((a, b) => a.name.localeCompare(b.name)),
      assignees: uniqueBy(memberRows, (row) => row.id).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }
}
