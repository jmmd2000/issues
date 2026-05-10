export const PRIORITIES = ["critical", "high", "medium", "low", "none"] as const;

export const STATUS_CATEGORIES = ["backlog", "active", "done", "cancelled"] as const;

export const LINK_TYPES = ["blocks", "depends_on", "duplicates", "relates_to", "clones"] as const;

export type Priority = (typeof PRIORITIES)[number];
export type StatusCategory = (typeof STATUS_CATEGORIES)[number];
export type LinkType = (typeof LINK_TYPES)[number];
