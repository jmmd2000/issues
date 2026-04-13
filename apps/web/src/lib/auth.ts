import { redirect } from "@sveltejs/kit";
import { resolve } from "$app/paths";
import type { CurrentUser } from "@issues/api";

export function requireAuth(user: CurrentUser | null): asserts user is CurrentUser {
  if (!user) redirect(302, resolve("/login"));
}
