import type { ActivityAction, Priority } from "./index";

/** Project shape returned from compact MCP endpoints. */
export type CompactProject = {
  key: string;
  name: string;
};

/** Token-efficient ticket summary used by list and write responses. */
export type CompactTicket = {
  /** Combined project key and number, e.g. `"DASH-12"`. */
  ref: string;
  title: string;
  /** Status name (human-readable, not slug). */
  status: string;
  priority: Priority;
  /** Label names, alphabetised. */
  labels: string[];
  /** `YYYY-MM-DD` representation of `updatedAt`. */
  updated: string;
};

/** Single-ticket detail. Description is excerpted to keep responses small. */
export type CompactTicketDetail = CompactTicket & {
  /** First 200 chars of the description, trimmed. */
  description: string;
  /** Assignee name, or `null` if unassigned. */
  assignee: string | null;
  /** Reporter name. */
  reporter: string;
};

/** One comment on a ticket, returned by `list_comments`. */
export type CompactComment = {
  /** Comment UUID, needed for future edit/delete tools. */
  id: string;
  /** Full markdown body. */
  body: string;
  /** Author name. */
  by: string;
  /** ISO `createdAt`. */
  at: string;
  edited: boolean;
};

/** Activity-feed entry. `oldValue`/`newValue` are pre-stringified for readability. */
export type CompactActivity = {
  ref: string;
  action: ActivityAction;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  /** User name. */
  by: string;
  /** ISO timestamp. */
  at: string;
};

/** Matches `KEY-123` where KEY is 2-6 upper-case letters and 123 is a positive integer. */
export const TICKET_REF_REGEX = /^([A-Z]{2,6})-([1-9][0-9]*)$/;

/**
 * Parses a compact ticket ref like `"DASH-12"` into its parts.
 * Returns `null` if the input does not match the expected shape.
 */
export function parseTicketRef(value: string): { projectKey: string; number: number } | null {
  const match = value.match(TICKET_REF_REGEX);
  if (!match) return null;
  return { projectKey: match[1], number: Number(match[2]) };
}

/** Formats a project key and ticket number into the canonical ref form. */
export function formatTicketRef(projectKey: string, number: number): string {
  return `${projectKey}-${number}`;
}
