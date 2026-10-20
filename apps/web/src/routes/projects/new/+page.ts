import { error } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import { createClient } from "$lib/api/client";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ parent, url, fetch }) => {
  const { user } = await parent();
  requireAuth(user, url);

  const res = await createClient(fetch).api.projects["with-counts"].$get();
  if (!res.ok) error(res.status, "Failed to load projects");
  const { projects } = await res.json();

  return { user, existingProjects: projects.map(project => ({ key: project.key, name: project.name })) };
};
