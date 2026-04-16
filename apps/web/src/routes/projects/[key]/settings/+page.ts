// Load function for project detail settings page
import { error } from "@sveltejs/kit";
import type { ProjectDetail } from "@issues/api";
import { createClient } from "$lib/api/client";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ fetch, params }) => {
  const res = await createClient(fetch).api.projects[":key"].$get({ param: { key: params.key } });
  if (!res.ok) throw error(res.status, "Failed to load project");
  const { project }: { project: ProjectDetail } = await res.json();
  return { project };
};
