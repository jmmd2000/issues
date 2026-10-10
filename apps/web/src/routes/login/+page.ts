import type { PageLoad } from "./$types";
import { createClient } from "$lib/api/client";

export const load: PageLoad = async ({ fetch }) => {
  // Fall back to closed, so a failed check hides the sign-up link rather than offering a dead end.
  const res = await createClient(fetch).api.auth["registration-status"].$get();
  const registrationOpen = res.ok ? (await res.json()).open : false;
  return { registrationOpen };
};
