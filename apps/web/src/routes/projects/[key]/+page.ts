import { error } from "@sveltejs/kit";
import { z } from "zod";
import type { Priority, ProjectActivity, ProjectDetail, ProjectStats, Ticket } from "@issues/api";
import { PRIORITIES } from "@issues/shared";
import { createClient } from "$lib/api/client";
import { requireAuth } from "$lib/auth";
import { LIST_COLUMN_IDS } from "$lib/components/tickets/TicketList.svelte";
import type { PageLoad } from "./$types";

const searchSchema = z.object({
  view: z.enum(["kanban", "list"]).catch("kanban"),
  page: z.coerce.number().int().min(1).catch(1),
  perPage: z.coerce.number().int().min(1).max(100).catch(25),
  sortBy: z.enum(LIST_COLUMN_IDS).catch("updatedAt"),
  sortDir: z.enum(["asc", "desc"]).catch("desc"),
  q: z.string().trim().min(1).max(200).nullable().catch(null),
  status: z.string().nullable().catch(null),
  priority: z.string().nullable().catch(null),
  assignee: z.string().nullable().catch(null),
  label: z.string().nullable().catch(null),
  showClosed: z.enum(["true", "false"]).nullable().catch(null),
  includeBacklog: z.enum(["true", "false"]).nullable().catch(null),
});

function parseList(value: string | null): string[] {
  if (!value) return [];
  return value.split(",").map((part) => part.trim()).filter(Boolean);
}

function parsePriorities(value: string | null): Priority[] {
  return parseList(value).filter((p): p is Priority => (PRIORITIES as readonly string[]).includes(p));
}

export const load: PageLoad = async ({ fetch, params, parent, url }) => {
  const { user } = await parent();
  requireAuth(user, url);

  const api = createClient(fetch).api.projects[":key"];
  const parsed = searchSchema.parse({
    view: url.searchParams.get("view"),
    page: url.searchParams.get("page"),
    perPage: url.searchParams.get("perPage"),
    sortBy: url.searchParams.get("sortBy"),
    sortDir: url.searchParams.get("sortDir"),
    q: url.searchParams.get("q"),
    status: url.searchParams.get("status"),
    priority: url.searchParams.get("priority"),
    assignee: url.searchParams.get("assignee"),
    label: url.searchParams.get("label"),
    showClosed: url.searchParams.get("showClosed"),
    includeBacklog: url.searchParams.get("includeBacklog"),
  });

  const view = parsed.view;
  const showClosed = parsed.showClosed === "true";
  const includeBacklog = parsed.includeBacklog !== "false"; // default true
  const titleSearch = parsed.q ?? undefined;

  const filters = {
    statusID: parseList(parsed.status),
    priority: parsePriorities(parsed.priority),
    assigneeID: parseList(parsed.assignee),
    labelID: parseList(parsed.label),
  };

  const sharedQuery: Record<string, string | string[]> = {};
  if (titleSearch) sharedQuery.titleSearch = titleSearch;
  if (filters.statusID.length) sharedQuery.statusID = filters.statusID;
  if (filters.priority.length) sharedQuery.priority = filters.priority;
  if (filters.assigneeID.length) sharedQuery.assigneeID = filters.assigneeID;
  if (filters.labelID.length) sharedQuery.labelID = filters.labelID;

  const boardRequest = view === "kanban"
    ? api.tickets.board.$get({
        param: { key: params.key },
        query: { ...sharedQuery, includeClosed: showClosed ? "true" : "false" },
      })
    : null;

  // Backlog-category tickets live behind a separate endpoint because /board
  // excludes them. Merging them in lets statuses like "Todo" still appear in
  // their own kanban column even when the "Include backlog" toggle hides the
  // dedicated Backlog status.
  const backlogRequest = view === "kanban"
    ? api.tickets.backlog.$get({ param: { key: params.key }, query: sharedQuery })
    : null;

  const listRequest = view === "list"
    ? api.tickets.$get({
        param: { key: params.key },
        query: {
          ...sharedQuery,
          page: String(parsed.page),
          perPage: String(parsed.perPage),
          sortBy: parsed.sortBy,
          sortDirection: parsed.sortDir,
          includeClosed: showClosed ? "true" : "false",
        },
      })
    : null;

  const [projectRes, boardRes, backlogRes, listRes, statsRes, activityRes] = await Promise.all([
    api.$get({ param: { key: params.key } }),
    boardRequest,
    backlogRequest,
    listRequest,
    api.stats.$get({ param: { key: params.key } }),
    api.activity.$get({ param: { key: params.key }, query: { limit: "20" } }),
  ]);

  if (!projectRes.ok) error(projectRes.status, "Failed to load project");
  const { project }: { project: ProjectDetail } = await projectRes.json();

  let boardTickets: Ticket[] = [];
  if (boardRes?.ok) {
    const body: { tickets: Ticket[] } = await boardRes.json();
    boardTickets = body.tickets;
  } else if (boardRes && boardRes.status !== 401 && boardRes.status !== 404) {
    error(boardRes.status, "Failed to load tickets");
  }

  let backlogTickets: Ticket[] = [];
  if (backlogRes?.ok) {
    const body: { tickets: Ticket[] } = await backlogRes.json();
    backlogTickets = body.tickets;
  }

  let listTickets: Ticket[] = [];
  let listTotal = 0;
  if (listRes?.ok) {
    const body: { tickets: Ticket[]; total: number } = await listRes.json();
    listTickets = body.tickets;
    listTotal = body.total;
  } else if (listRes && listRes.status !== 401 && listRes.status !== 404) {
    error(listRes.status, "Failed to load tickets");
  }

  let stats: ProjectStats = {
    totalTickets: 0,
    openTickets: 0,
    closedTickets: 0,
    lastActivityAt: null,
    byMember: {},
  };
  if (statsRes.ok) {
    const body: { stats: ProjectStats } = await statsRes.json();
    stats = body.stats;
  }

  let activity: ProjectActivity[] = [];
  if (activityRes.ok) {
    const body: { activity: ProjectActivity[] } = await activityRes.json();
    activity = body.activity;
  }

  return {
    user,
    project,
    boardTickets,
    backlogTickets,
    listTickets,
    listTotal,
    stats,
    activity,
    view,
    showClosed,
    includeBacklog,
    titleSearch: titleSearch ?? "",
    filters,
    pagination: { page: parsed.page, perPage: parsed.perPage },
    sort: { by: parsed.sortBy, dir: parsed.sortDir },
  };
};
