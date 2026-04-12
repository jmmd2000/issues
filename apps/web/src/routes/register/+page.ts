// Load function for "/register"
import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";
import { createClient } from "$lib/api/client";

export const load: PageLoad = async ({ fetch }) => {
  const res = await createClient(fetch).api.auth["registration-status"].$get();
  if (!res.ok) error(res.status, "Failed to check registration status");
  const { open } = await res.json();
  return { open };
};
