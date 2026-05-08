// Load function for ticket detail page
import { error } from "@sveltejs/kit";
import type { Comment, ProjectDetail, TicketDetail } from "@issues/api";
import { requireAuth } from "$lib/auth";
import { createClient } from "$lib/api/client";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ fetch, params, parent }) => {
  const { user } = await parent();
  requireAuth(user);

  const api = createClient(fetch).api.projects[":key"];

  const [projectRes, ticketRes, commentsRes] = await Promise.all([
    api.$get({ param: { key: params.key } }),
    api.tickets[":num"].$get({
      param: { key: params.key, num: params.num },
    }),
    api.tickets[":num"].comments.$get({
      param: { key: params.key, num: params.num },
    }),
  ]);

  if (!projectRes.ok) error(projectRes.status, "Failed to load project");
  if (!ticketRes.ok) error(ticketRes.status, "Failed to load ticket");
  if (!commentsRes.ok) error(commentsRes.status, "Failed to load comments");

  const { project }: { project: ProjectDetail } = await projectRes.json();
  const { ticket }: { ticket: TicketDetail } = await ticketRes.json();
  const { comments }: { comments: Comment[] } = await commentsRes.json();

  return { user, project, ticket, comments };
};
