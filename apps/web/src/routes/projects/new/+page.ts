import { requireAuth } from "$lib/auth";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ parent, url }) => {
  const { user } = await parent();
  requireAuth(user, url);
  return { user };
};
