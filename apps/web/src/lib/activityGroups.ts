import type { GlobalActivity } from "@issues/api";

/** Consecutive changes by one person in one project collapse into one line from this many on. */
const MIN_RUN_LENGTH = 3;

const DAY = 24 * 60 * 60 * 1000;
const EARLIER_DAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });

export type FeedEntry = { kind: "single"; event: GlobalActivity } | { kind: "run"; label: string; events: GlobalActivity[] };

export interface DayGroup {
  /** The start of the day in local time, as a timestamp. */
  id: number;
  label: string;
  /** How many changes the day holds. A collapsed run counts every change in it. */
  count: number;
  /** Only today starts open. */
  open: boolean;
  entries: FeedEntry[];
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function dayLabel(day: number, today: number) {
  const daysAgo = Math.round((today - day) / DAY);
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  return EARLIER_DAY.format(new Date(day));
}

function isLinkChange(event: GlobalActivity) {
  return event.action === "link_added" || event.action === "link_removed";
}

function isLabelChange(event: GlobalActivity) {
  return event.action === "label_added" || event.action === "label_removed";
}

function runLabel(events: GlobalActivity[]) {
  const projectKey = events[0].project.key;
  if (events.every(isLinkChange)) return `${events.length} link changes in ${projectKey}`;
  if (events.every(isLabelChange)) return `${events.length} label changes in ${projectKey}`;
  return `${events.length} changes in ${projectKey}`;
}

function sameSource(first: GlobalActivity, second: GlobalActivity) {
  return first.userID === second.userID && first.project.key === second.project.key;
}

function collapseRuns(events: GlobalActivity[]): FeedEntry[] {
  const entries: FeedEntry[] = [];
  let start = 0;

  while (start < events.length) {
    let end = start + 1;
    while (end < events.length && sameSource(events[start], events[end])) end++;

    const run = events.slice(start, end);
    if (run.length >= MIN_RUN_LENGTH) {
      entries.push({ kind: "run", label: runLabel(run), events: run });
    } else {
      for (const event of run) entries.push({ kind: "single", event });
    }
    start = end;
  }
  return entries;
}

/**
 * Groups the feed by day in local time, newest day first. Within a day, several consecutive
 * changes by one person in one project collapse into a single entry.
 * @param now The current time, which decides what counts as today and yesterday
 */
export function groupFeed(events: GlobalActivity[], now: Date = new Date()): DayGroup[] {
  const today = startOfDay(now);
  const newestFirst = [...events].sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
  const byDay = new Map<number, GlobalActivity[]>();

  for (const event of newestFirst) {
    const day = startOfDay(new Date(event.createdAt));
    byDay.set(day, [...(byDay.get(day) ?? []), event]);
  }

  return Array.from(byDay, ([day, dayEvents]) => ({
    id: day,
    label: dayLabel(day, today),
    count: dayEvents.length,
    open: day === today,
    entries: collapseRuns(dayEvents),
  }));
}
