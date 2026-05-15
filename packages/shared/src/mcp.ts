import type { ActivityAction, LinkType, Priority, StatusCategory } from "./index";

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
  /** `YYYY-MM-DD` representation of `createdAt`. */
  created: string;
  /** `YYYY-MM-DD` representation of `updatedAt`. */
  updated: string;
};

/** Paginated search response. */
export type CompactSearchPage = {
  tickets: CompactTicket[];
  total: number;
  page: number;
  perPage: number;
  hasNextPage: boolean;
};

/** Single-ticket detail. Description is excerpted unless `full` is requested. */
export type CompactTicketDetail = CompactTicket & {
  /** First 200 chars of the description trimmed, or the full body when `full=true` was requested. */
  description: string;
  /** Whether `description` is the full body (true) or truncated (false). */
  descriptionTruncated: boolean;
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

/** Linked-ticket relationship as seen from the queried ticket. */
export type CompactLink = {
  /** Partner ticket's ref. */
  ref: string;
  /** Partner title. */
  title: string;
  /** Partner status name. */
  status: string;
  linkType: LinkType;
  /** `outgoing`: the queried ticket is the source; `incoming`: it is the target. */
  direction: "outgoing" | "incoming";
};

/** Project member exposed to MCP — name only, no avatar URL. */
export type CompactMember = {
  name: string;
  email: string;
  role: "owner" | "member";
};

/** Status definition for a project, in display order. */
export type CompactStatus = {
  name: string;
  slug: string;
  category: StatusCategory;
};

/** Label definition for a project. */
export type CompactLabel = {
  name: string;
  colour: string;
};

/** Per-member counts inside `CompactStats`. */
export type CompactMemberStats = {
  assignedOpen: number;
  assignedTotal: number;
  reported: number;
};

/** Project-wide ticket counts. `byMember` is keyed by user name. */
export type CompactStats = {
  total: number;
  open: number;
  closed: number;
  lastActivityAt: string | null;
  byMember: Record<string, CompactMemberStats>;
};

/** Aggregate project detail: project metadata plus the lists Claude needs to make valid calls. */
export type CompactProjectDetail = CompactProject & {
  description: string | null;
  members: CompactMember[];
  statuses: CompactStatus[];
  labels: CompactLabel[];
};

/** Attachment summary returned by `list_attachments`. */
export type CompactAttachment = {
  /** Stable attachment id, needed if future tools want to remove or replace. */
  id: string;
  filename: string;
  /** Bytes on disk. */
  sizeBytes: number;
  mimeType: string;
  /** True for image MIME types — Claude can decide whether to fetch the bytes. */
  isImage: boolean;
  /** Uploader name. */
  by: string;
  /** ISO `createdAt`. */
  at: string;
  /** Public URL relative to the API origin. */
  url: string;
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
