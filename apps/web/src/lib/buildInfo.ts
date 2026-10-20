import { formatAbsolute } from "$lib/time";

export interface WebBuild {
  siteVersion: string;
  gitSha: string;
  builtAt: string | null;
  packages: { name: string; version: string }[];
}

/** What this copy of the web app was built from. It is fixed when the app is built. */
export const webBuild: WebBuild = {
  siteVersion: __SITE_VERSION__,
  gitSha: __GIT_SHA__,
  builtAt: __BUILT_AT__,
  packages: __WEB_PACKAGES__,
};

/** Shortens a commit hash to seven characters. A value such as `dev` stays as it is. */
export function shortHash(gitSha: string): string {
  return gitSha.slice(0, 7);
}

/** Returns true when the web app and the API were built from different commits. */
export function commitsDiffer(webSha: string, apiSha: string): boolean {
  return shortHash(webSha) !== shortHash(apiSha);
}

/**
 * Formats a build time for display.
 * @param builtAt The build time, or `null` for a local run
 * @returns A readable date and time, `Not recorded` for `null`, or the original text if it is not a date
 */
export function formatBuiltAt(builtAt: string | null): string {
  if (!builtAt) return "Not recorded";
  if (Number.isNaN(new Date(builtAt).getTime())) return builtAt;
  return formatAbsolute(builtAt);
}
