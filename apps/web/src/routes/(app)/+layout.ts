// Load function for authed pages = (app)
import { redirect } from "@sveltejs/kit";
import { resolve } from "$app/paths";
import type { LayoutLoad } from "./$types";

export const load: LayoutLoad = async ({ parent }) => {
  const { user } = await parent();
  if (!user) redirect(302, resolve("/login"));
  return { user };
};
