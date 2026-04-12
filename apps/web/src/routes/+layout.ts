// Load function for root level layout
import type { LayoutLoad } from "./$types";
import { createClient } from "$lib/api/client";

export const load: LayoutLoad = async ({ fetch }) => {
  const res = await createClient(fetch).api.auth.me.$get();
  if (!res.ok) return { user: null };
  const { user } = await res.json();
  return { user };
};
