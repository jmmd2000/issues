import { error } from "@sveltejs/kit";
import { z } from "zod";
import type { ProjectActivity, ProjectDetail, ProjectStats, Ticket } from "@issues/api";
import { createClient } from "$lib/api/client";
import { requireAuth } from "$lib/auth";
import { LIST_COLUMN_IDS } from "$lib/components/tickets/TicketList.svelte";
import type { PageLoad } from "./$types";

const searchSchema = z.object({
  view: z.enum(["kanban", "list"]).catch("kanban"),
  page: z.coerce.number().int().min(1).catch(1),
  perPage: z.coerce.number().int().min(1).max(100).catch(25),
  sortBy: z.enum(LIST_COLUMN_IDS).catch("updatedAt"),
  sortDirection: z.enum(["asc", "desc"]).catch("desc"),
  q: z.string().trim().min(1).max(200).nullable().catch(null),
  status: z.string().nullable().catch(null),
  priority: z.string().nullable().catch(null),
  assignee: z.string().nullable().catch(null),
  label: z.string().nullable().catch(null),
  showClosed: z.enum(["true", "false"]).nullable().catch(null),
  backlog: z.enum(["true", "false"]).nullable().catch(null),
});

function parseList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
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
    sortDirection: url.searchParams.get("sortDirection"),
    q: url.searchParams.get("q"),
    status: url.searchParams.get("status"),
    priority: url.searchParams.get("priority"),
    assignee: url.searchParams.get("assignee"),
    label: url.searchParams.get("label"),
    showClosed: url.searchParams.get("showClosed"),
    backlog: url.searchParams.get("backlog"),
  });

  const view = parsed.view;
  const showClosed = parsed.showClosed === "true";
  const backlogOpen = parsed.backlog === "true";
  const titleSearch = parsed.q ?? undefined;

  const filters = {
    statusID: parseList(parsed.status),
    priority: parseList(parsed.priority),
    assigneeID: parseList(parsed.assignee),
    labelID: parseList(parsed.label),
  };

  const sharedQuery: Record<string, string | string[]> = {};
  if (titleSearch) sharedQuery.titleSearch = titleSearch;
  if (filters.statusID.length) sharedQuery.statusID = filters.statusID;
  if (filters.priority.length) sharedQuery.priority = filters.priority;
  if (filters.assigneeID.length) sharedQuery.assigneeID = filters.assigneeID;
  if (filters.labelID.length) sharedQuery.labelID = filters.labelID;

  const ticketsRequest =
    view === "list"
      ? api.tickets.$get({
          param: { key: params.key },
          query: {
            ...sharedQuery,
            page: String(parsed.page),
            perPage: String(parsed.perPage),
            sortBy: parsed.sortBy,
            sortDirection: parsed.sortDirection,
            includeClosed: showClosed ? "true" : "false",
          },
        })
      : api.tickets.board.$get({
          param: { key: params.key },
          query: {
            ...sharedQuery,
            includeClosed: showClosed ? "true" : "false",
          },
        });

  const backlogRequest = view === "kanban" && backlogOpen ? api.tickets.backlog.$get({ param: { key: params.key }, query: sharedQuery }) : null;

  const [projectRes, ticketsRes, backlogRes, statsRes, activityRes] = await Promise.all([
    api.$get({ param: { key: params.key } }),
    ticketsRequest,
    backlogRequest,
    api.stats.$get({ param: { key: params.key } }),
    api.activity.$get({ param: { key: params.key }, query: { limit: "20" } }),
  ]);

  if (!projectRes.ok) error(projectRes.status, "Failed to load project");

  const { project }: { project: ProjectDetail } = await projectRes.json();

  let stats: ProjectStats = { totalTickets: 0, openTickets: 0, closedTickets: 0, lastActivityAt: null, byMember: {} };
  if (statsRes.ok) {
    const body: { stats: ProjectStats } = await statsRes.json();
    stats = body.stats;
  }

  let activity: ProjectActivity[] = [];
  if (activityRes.ok) {
    const body: { activity: ProjectActivity[] } = await activityRes.json();
    activity = body.activity;
  }

  let tickets: Ticket[] = [];
  if (ticketsRes.ok) {
    const body: { tickets: Ticket[] } = await ticketsRes.json();
    tickets = body.tickets;
  } else if (ticketsRes.status !== 401 && ticketsRes.status !== 404) {
    error(ticketsRes.status, "Failed to load tickets");
  }

  let backlogTickets: Ticket[] = [];
  if (backlogRes && backlogRes.ok) {
    const body: { tickets: Ticket[] } = await backlogRes.json();
    backlogTickets = body.tickets;
  }

  return {
    user,
    project,
    ticketView: view,
    ticketData:
      view === "list"
        ? {
            kind: "list" as const,
            tickets,
            page: parsed.page,
            perPage: parsed.perPage,
            hasNextPage: tickets.length === parsed.perPage,
            sortColumn: parsed.sortBy,
            sortDirection: parsed.sortDirection,
          }
        : { kind: "kanban" as const, tickets },
    backlog: { open: backlogOpen, tickets: backlogTickets },
    filters: {
      titleSearch,
      statusID: filters.statusID,
      priority: filters.priority,
      assigneeID: filters.assigneeID,
      labelID: filters.labelID,
      showClosed,
    },
    statuses: project.statuses,
    labels: project.labels,
    members: project.members,
    stats,
    activity,
  };
};
