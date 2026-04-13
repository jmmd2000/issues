import { requireAuth } from "$lib/auth";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ parent }) => {
  const { user } = await parent();
  requireAuth(user);
  return { user };
};
