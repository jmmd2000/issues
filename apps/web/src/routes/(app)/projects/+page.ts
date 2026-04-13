import { error } from "@sveltejs/kit";
import type { Project } from "@issues/api";
import { createClient } from "$lib/api/client";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ fetch }) => {
  const res = await createClient(fetch).api.projects.$get();
  if (!res.ok) error(res.status, "Failed to load projects");
  const { projects }: { projects: Project[] } = await res.json();
  return { projects };
};
