// Load function for the per-user account settings page
import type { PageLoad } from "./$types";
import { requireAuth } from "$lib/auth";

export const load: PageLoad = async ({ parent, url }) => {
  const { user } = await parent();
  requireAuth(user, url);
  return { user };
};
