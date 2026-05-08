// Relative time formatter (e.g. "2 minutes ago", "3 days ago").
// Falls back to absolute date for anything beyond a week so timestamps remain
// scannable in long threads.

const RELATIVE = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

const ABSOLUTE = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const ABSOLUTE_DATE_ONLY = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * Returns a human-readable relative timestamp for `value`. Within the last
 * minute returns "just now"; within a week returns Intl.RelativeTimeFormat
 * output; older values fall back to a short absolute date.
 */
export function timeAgo(value: string | Date | null | undefined, now: Date = new Date()): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  const diff = now.getTime() - date.getTime();

  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return RELATIVE.format(-Math.round(diff / MINUTE), "minute");
  if (diff < DAY) return RELATIVE.format(-Math.round(diff / HOUR), "hour");
  if (diff < WEEK) return RELATIVE.format(-Math.round(diff / DAY), "day");
  return ABSOLUTE_DATE_ONLY.format(date);
}

/** Long absolute timestamp suitable for a `title` tooltip alongside `timeAgo`. */
export function formatAbsolute(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  return ABSOLUTE.format(date);
}
