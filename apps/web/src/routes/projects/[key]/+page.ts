// Load function for project detail page
import { error } from "@sveltejs/kit";
import { z } from "zod";
import type { ProjectDetail, Ticket } from "@issues/api";
import { createClient } from "$lib/api/client";
import type { PageLoad } from "./$types";

const searchSchema = z.object({
  view: z.enum(["kanban", "list"]).catch("kanban"),
  page: z.coerce.number().int().min(1).catch(1),
  perPage: z.coerce.number().int().min(1).max(100).catch(25),
});

export const load: PageLoad = async ({ fetch, params, url }) => {
  const api = createClient(fetch).api.projects[":key"];
  const { view, page, perPage } = searchSchema.parse({
    view: url.searchParams.get("view"),
    page: url.searchParams.get("page"),
    perPage: url.searchParams.get("perPage"),
  });

  const ticketsRequest =
    view === "list" ? api.tickets.$get({ param: { key: params.key }, query: { page: String(page), perPage: String(perPage) } }) : api.tickets.board.$get({ param: { key: params.key }, query: {} });

  const [projectRes, ticketsRes] = await Promise.all([api.$get({ param: { key: params.key } }), ticketsRequest]);

  if (!projectRes.ok) error(projectRes.status, "Failed to load project");

  const { project }: { project: ProjectDetail } = await projectRes.json();

  let tickets: Ticket[] = [];
  if (ticketsRes.ok) {
    const body: { tickets: Ticket[] } = await ticketsRes.json();
    tickets = body.tickets;
  } else if (ticketsRes.status !== 401 && ticketsRes.status !== 404) {
    error(ticketsRes.status, "Failed to load tickets");
  }

  return {
    project,
    ticketView: view,
    ticketData: view === "list" ? { kind: "list" as const, tickets, page, perPage, hasNextPage: tickets.length === perPage } : { kind: "kanban" as const, tickets },
    statuses: project.statuses,
    labels: project.labels,
    members: project.members,
  };
};
