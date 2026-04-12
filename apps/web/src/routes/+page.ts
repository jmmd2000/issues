// Load function for "/"
import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";
import { createClient } from "$lib/api/client";

export const load: PageLoad = async ({ fetch }) => {
  const res = await createClient(fetch).api.health.$get();
  if (!res.ok) error(res.status, "Failed to fetch API health");
  const healthStatus = await res.json();
  return { healthStatus };
};
