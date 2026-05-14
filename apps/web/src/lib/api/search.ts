import { z } from "zod";
import type { Priority, SearchFilterOptions, SearchResult, SearchSortColumn, SearchSortDirection } from "@issues/api";
import { PRIORITIES } from "@issues/shared";
import { createClient } from "./client";

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 25;

export const SEARCH_SORT_COLUMNS = ["relevance", "updatedAt", "createdAt", "title"] as const satisfies readonly SearchSortColumn[];
export const SEARCH_SORT_DIRECTIONS = ["asc", "desc"] as const satisfies readonly SearchSortDirection[];

const searchParamSchema = z.object({
  q: z.string().trim().max(200).catch(""),
  project: z
    .string()
    .trim()
    .min(2)
    .max(6)
    .transform((value) => value.toUpperCase())
    .nullable()
    .catch(null),
  page: z.coerce.number().int().min(1).catch(DEFAULT_PAGE),
  perPage: z.coerce.number().int().min(1).max(100).catch(DEFAULT_PER_PAGE),
  sortBy: z.enum(SEARCH_SORT_COLUMNS).nullable().catch(null),
  sortDirection: z.enum(SEARCH_SORT_DIRECTIONS).nullable().catch(null),
});

export type SearchPageState = {
  searchTerm: string;
  projectKey: string | null;
  statusSlugs: string[];
  priorities: Priority[];
  labelNames: string[];
  assigneeIDs: string[];
  page: number;
  perPage: number;
  sortBy: SearchSortColumn;
  sortDirection: SearchSortDirection;
};

export type SearchPageResult = {
  state: SearchPageState;
  filters: SearchFilterOptions;
  tickets: SearchResult[];
  hasNextPage: boolean;
  searched: boolean;
};

function parseList(params: URLSearchParams, key: string): string[] {
  return params
    .getAll(key)
    .flatMap((value) => value.split(","))
    .map((part) => part.trim())
    .filter(Boolean);
}

function parsePriorities(params: URLSearchParams): Priority[] {
  return parseList(params, "priority").filter((value): value is Priority => (PRIORITIES as readonly string[]).includes(value));
}

export function defaultSearchSortColumn(searchTerm: string, sortBy?: SearchSortColumn | null): SearchSortColumn {
  if (sortBy === "relevance" && !searchTerm.trim()) return "updatedAt";
  return sortBy ?? (searchTerm.trim() ? "relevance" : "updatedAt");
}

export function defaultSearchSortDirection(sortBy: SearchSortColumn, sortDirection?: SearchSortDirection | null): SearchSortDirection {
  return sortDirection ?? (sortBy === "title" ? "asc" : "desc");
}

export function parseSearchPageState(url: URL, lockedProjectKey: string | null = null): SearchPageState {
  const parsed = searchParamSchema.parse({
    q: url.searchParams.get("q") ?? "",
    project: lockedProjectKey ?? url.searchParams.get("project"),
    page: url.searchParams.get("page"),
    perPage: url.searchParams.get("perPage"),
    sortBy: url.searchParams.get("sortBy"),
    sortDirection: url.searchParams.get("sortDirection"),
  });
  const sortBy = defaultSearchSortColumn(parsed.q, parsed.sortBy);
  const sortDirection = defaultSearchSortDirection(sortBy, parsed.sortDirection);

  return {
    searchTerm: parsed.q,
    projectKey: lockedProjectKey ?? parsed.project,
    statusSlugs: parseList(url.searchParams, "status"),
    priorities: parsePriorities(url.searchParams),
    labelNames: parseList(url.searchParams, "label"),
    assigneeIDs: parseList(url.searchParams, "assignee"),
    page: parsed.page,
    perPage: parsed.perPage,
    sortBy,
    sortDirection,
  };
}

export function serialiseSearchPageState(state: SearchPageState, lockedProjectKey: string | null = null): URLSearchParams {
  const params = new URLSearchParams();

  if (state.searchTerm.trim()) params.set("q", state.searchTerm.trim());
  if (!lockedProjectKey && state.projectKey) params.set("project", state.projectKey);
  if (state.statusSlugs.length) params.set("status", state.statusSlugs.join(","));
  if (state.priorities.length) params.set("priority", state.priorities.join(","));
  if (state.labelNames.length) params.set("label", state.labelNames.join(","));
  if (state.assigneeIDs.length) params.set("assignee", state.assigneeIDs.join(","));
  if (state.sortBy !== defaultSearchSortColumn(state.searchTerm)) params.set("sortBy", state.sortBy);
  if (state.sortDirection !== defaultSearchSortDirection(state.sortBy)) params.set("sortDirection", state.sortDirection);
  if (state.page !== DEFAULT_PAGE) params.set("page", String(state.page));
  if (state.perPage !== DEFAULT_PER_PAGE) params.set("perPage", String(state.perPage));

  return params;
}

export function hasSearchCriteria(state: SearchPageState, lockedProjectKey: string | null = null): boolean {
  return Boolean(state.searchTerm.trim() || (!lockedProjectKey && state.projectKey) || state.statusSlugs.length || state.priorities.length || state.labelNames.length || state.assigneeIDs.length);
}

type SearchRouteQuery = {
  status: string[];
  priority: string[];
  label: string[];
  assignee: string[];
  q?: string;
  project?: string;
  sortBy?: SearchSortColumn;
  sortDirection?: SearchSortDirection;
  page: string;
  perPage: string;
};

function searchQuery(state: SearchPageState): SearchRouteQuery {
  const query: SearchRouteQuery = {
    status: state.statusSlugs,
    priority: state.priorities,
    label: state.labelNames,
    assignee: state.assigneeIDs,
    page: String(state.page),
    perPage: String(state.perPage),
  };

  if (state.searchTerm.trim()) query.q = state.searchTerm.trim();
  if (state.projectKey) query.project = state.projectKey;
  query.sortBy = state.sortBy;
  query.sortDirection = state.sortDirection;

  return query;
}

export async function loadSearchPageResult(input: { fetch: typeof globalThis.fetch; url: URL; lockedProjectKey?: string | null }): Promise<SearchPageResult> {
  const lockedProjectKey = input.lockedProjectKey?.toUpperCase() ?? null;
  const state = parseSearchPageState(input.url, lockedProjectKey);
  const api = createClient(input.fetch).api.search;

  const filtersResponse = await api.filters.$get({
    query: lockedProjectKey ? { project: lockedProjectKey } : {},
  });

  if (!filtersResponse.ok) {
    throw new Error(`Failed to load search filters (${filtersResponse.status}).`);
  }

  const { filters }: { filters: SearchFilterOptions } = await filtersResponse.json();
  if (!hasSearchCriteria(state, lockedProjectKey)) {
    return { state, filters, tickets: [], hasNextPage: false, searched: false };
  }

  const searchResponse = await api.$get({ query: searchQuery(state) });
  if (!searchResponse.ok) {
    throw new Error(`Failed to load search results (${searchResponse.status}).`);
  }

  const { tickets, hasNextPage }: { tickets: SearchResult[]; hasNextPage: boolean } = await searchResponse.json();
  return { state, filters, tickets, hasNextPage, searched: true };
}
