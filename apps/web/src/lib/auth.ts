import { redirect } from "@sveltejs/kit";
import { resolve } from "$app/paths";
import type { CurrentUser } from "@issues/api";

/**
 * Asserts the load context has an authenticated user. When `url` is supplied
 * and the user is missing, the caller is sent to `/login?next=<pathname+search>`
 * so the login page can return them to the page they originally requested
 * after a successful sign-in.
 *
 * Pass the SvelteKit load `url`. If a load is happy to drop the deep link
 * (rare), omit it and the redirect will land on `/`.
 */
export function requireAuth(user: CurrentUser | null, url?: URL): asserts user is CurrentUser {
  if (user) return;
  if (!url) redirect(302, resolve("/login"));
  const loginPath = resolve("/login");
  if (url.pathname === loginPath) redirect(302, loginPath);
  const next = `${url.pathname}${url.search}`;
  redirect(302, `${loginPath}?next=${encodeURIComponent(next)}`);
}
