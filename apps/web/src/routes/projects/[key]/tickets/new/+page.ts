import { error } from "@sveltejs/kit";
import type { ProjectDetail, TicketDetail } from "@issues/api";
import { requireAuth } from "$lib/auth";
import { createClient } from "$lib/api/client";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ fetch, params, parent, url }) => {
  const { user } = await parent();
  requireAuth(user);

  const apiClient = createClient(fetch);

  const projectRes = await apiClient.api.projects[":key"].$get({
    param: { key: params.key },
  });

  if (!projectRes.ok) error(projectRes.status, "Failed to load project");

  const { project }: { project: ProjectDetail } = await projectRes.json();

  // Optional ?parent=<number> prefills the form with this ticket as the parent.
  // Used by the "Add sub-ticket" CTA on the parent's detail page.
  const parentParam = url.searchParams.get("parent");
  let parentTicket: { id: string; number: number; title: string } | null = null;

  if (parentParam) {
    const num = Number(parentParam);
    if (Number.isInteger(num) && num > 0) {
      const parentRes = await apiClient.api.projects[":key"].tickets[":num"].$get({
        param: { key: params.key, num: String(num) },
      });
      if (parentRes.ok) {
        const { ticket }: { ticket: TicketDetail } = await parentRes.json();
        parentTicket = { id: ticket.id, number: ticket.number, title: ticket.title };
      }
    }
  }

  return {
    user,
    project,
    statuses: project.statuses,
    labels: project.labels,
    members: project.members,
    parentTicket,
  };
};
