// Load function for project detail settings page
import { error } from "@sveltejs/kit";
import { z } from "zod";
import type { ProjectDetail, Ticket } from "@issues/api";
import { createClient } from "$lib/api/client";
import { requireAuth } from "$lib/auth";
import { LIST_COLUMN_IDS } from "$lib/components/tickets/TicketList.svelte";
import type { PageLoad } from "./$types";

const TRASH_PER_PAGE = 25;

const trashPageSchema = z.coerce.number().int().min(1).catch(1);
const trashSortBySchema = z.enum(LIST_COLUMN_IDS).catch("updatedAt");
const trashSortDirectionSchema = z.enum(["asc", "desc"]).catch("desc");

export const load: PageLoad = async ({ fetch, params, parent, url }) => {
  const { user } = await parent();
  requireAuth(user, url);

  const api = createClient(fetch).api.projects[":key"];
  const res = await api.$get({ param: { key: params.key } });
  if (!res.ok) throw error(res.status, "Failed to load project");
  const { project }: { project: ProjectDetail } = await res.json();

  const isOwner = project.members.some((member) => member.userID === user.id && member.role === "owner");
  const trashPage = trashPageSchema.parse(url.searchParams.get("trashPage"));
  const trashSortBy = trashSortBySchema.parse(url.searchParams.get("trashSortBy"));
  const trashSortDirection = trashSortDirectionSchema.parse(url.searchParams.get("trashSortDirection"));

  // Trash list is owner-only -- skip the API call entirely for non-owners so a 403 doesn't surface as a noisy load error.
  let trashTickets: Ticket[] = [];
  let hasNextTrashPage = false;
  if (isOwner) {
    const trashRes = await api.tickets.trash.$get({
      param: { key: params.key },
      query: { sortBy: trashSortBy, sortDirection: trashSortDirection, page: String(trashPage), perPage: String(TRASH_PER_PAGE) },
    });
    if (trashRes.ok) {
      const body: { tickets: Ticket[] } = await trashRes.json();
      trashTickets = body.tickets;
      hasNextTrashPage = body.tickets.length === TRASH_PER_PAGE;
    }
  }

  return { user, project, isOwner, trashTickets, trashPage, hasNextTrashPage, trashSortBy, trashSortDirection };
};
