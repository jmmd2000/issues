export type ErrorAction = "sign-in-again" | "sign-in" | "retry" | "none";

/**
 * Picks the main button on an error page.
 * A 401 asks for a new sign in. A 403 or 404 offers sign in only when nobody is signed in,
 * because a private page looks like a missing page until you sign in.
 */
export function errorAction(status: number, signedIn: boolean): ErrorAction {
  if (status === 401) return "sign-in-again";
  if (status >= 500) return "retry";
  if ((status === 403 || status === 404) && !signedIn) return "sign-in";
  return "none";
}

/** Tells whether the page data holds a signed-in user. Page data has no declared shape, so this checks it. */
export function hasSignedInUser(data: unknown): boolean {
  if (typeof data !== "object" || data === null) return false;
  return "user" in data && Boolean(data.user);
}
