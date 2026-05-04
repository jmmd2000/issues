export const PRIORITIES = ["critical", "high", "medium", "low", "none"] as const;

export const STATUS_CATEGORIES = ["backlog", "active", "done", "cancelled"] as const;

export type Priority = (typeof PRIORITIES)[number];
export type StatusCategory = (typeof STATUS_CATEGORIES)[number];
