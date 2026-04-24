import { error } from "@sveltejs/kit";
import type { ProjectDetail } from "@issues/api";
import { requireAuth } from "$lib/auth";
import { createClient } from "$lib/api/client";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ fetch, params, parent }) => {
  const { user } = await parent();
  requireAuth(user);

  const res = await createClient(fetch).api.projects[":key"].$get({
    param: { key: params.key },
  });

  if (!res.ok) error(res.status, "Failed to load project");

  const { project }: { project: ProjectDetail } = await res.json();

  return {
    user,
    project,
    statuses: project.statuses,
    labels: project.labels,
    members: project.members,
  };
};
