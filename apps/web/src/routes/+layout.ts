// Load function for root level layout
import type { CurrentUser } from "@issues/api";
import type { LayoutLoad } from "./$types";
import { createClient } from "$lib/api/client";

export const load: LayoutLoad = async ({ fetch }) => {
  const res = await createClient(fetch).api.auth.me.$get();
  if (!res.ok) return { user: null };
  const { user }: { user: CurrentUser } = await res.json();
  return { user };
};
