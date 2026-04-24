export const PRIORITIES = ["critical", "high", "medium", "low", "none"] as const;

export const STATUS_CATEGORIES = ["backlog", "active", "done", "cancelled"] as const;

export const ACTIVITY_ACTIONS = [
  "created",
  "updated",
  "deleted",
  "restored",
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
