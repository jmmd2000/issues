import type { BuildInfo } from "@issues/api";
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

export interface BuildRow {
  label: string;
  value: string;
}

/** The rows that describe this copy of the web app. */
export function webBuildRows(build: WebBuild): BuildRow[] {
  return [{ label: "Commit", value: shortHash(build.gitSha) }, { label: "Built", value: formatBuiltAt(build.builtAt) }, ...build.packages.map(item => ({ label: item.name, value: item.version }))];
}

/** The rows that describe the API. A version the API could not report shows as `Unknown`. */
export function apiBuildRows(build: BuildInfo): BuildRow[] {
  return [
    { label: "Commit", value: shortHash(build.gitSha) },
    { label: "Built", value: formatBuiltAt(build.builtAt) },
    { label: "Node", value: build.nodeVersion },
    { label: "Postgres", value: build.postgresVersion ?? "Unknown" },
    ...build.packages.map(item => ({ label: item.name, value: item.version ?? "Unknown" })),
  ];
}

export interface BuildStatement {
  type: "success" | "error";
  text: string;
}

/** A plain sentence that says whether the web app and the API come from the same commit. */
export function buildStatement(web: WebBuild, api: BuildInfo | null): BuildStatement {
  if (!api) return { type: "error", text: "The API build could not be loaded. Only the web build is shown." };
  if (commitsDiffer(web.gitSha, api.gitSha)) return { type: "error", text: "The web app and the API were built from different commits." };
  return { type: "success", text: "The web app and the API were built from the same commit." };
}

function formatRows(title: string, rows: BuildRow[]): string {
  return [title, ...rows.map(row => `  ${row.label}: ${row.value}`)].join("\n");
}

/** Formats the build details as plain text, for pasting into a bug report. */
export function buildDetailsText(siteVersion: string, webRows: BuildRow[], apiRows: BuildRow[] | null): string {
  const sections = [`Site version: ${siteVersion}`, formatRows("Web", webRows)];
  if (apiRows) sections.push(formatRows("API", apiRows));
  return sections.join("\n\n");
}
