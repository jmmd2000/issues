export const PRIORITIES = ["critical", "high", "medium", "low", "none"] as const;

export const STATUS_CATEGORIES = ["backlog", "active", "done", "cancelled"] as const;

export const LINK_TYPES = ["blocks", "depends_on", "duplicates", "relates_to", "clones"] as const;

export const ACTIVITY_ACTIONS = [
  "created",
  "updated",
  "deleted",
  "restored",
  "cloned_from",
  "label_added",
  "label_removed",
  "comment_added",
  "comment_edited",
  "comment_deleted",
  "link_added",
  "link_removed",
  "attachment_added",
  "attachment_removed",
] as const;

export type Priority = (typeof PRIORITIES)[number];
export type StatusCategory = (typeof STATUS_CATEGORIES)[number];
export type LinkType = (typeof LINK_TYPES)[number];
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export * from "./mcp";
