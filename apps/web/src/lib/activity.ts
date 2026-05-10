// Renders ticket_activity rows as humanised sentences. Data -> string;
// the component layer handles user names, avatars, and timestamps separately.
import type { ActivityValue, TicketActivity } from "@issues/api";

function refName(value: ActivityValue | null | undefined): string | null {
  return value?.name ?? null;
}

function priorityLabel(value: ActivityValue | null | undefined): string {
  return value?.value ?? "none";
}

/**
 * Returns a single-line verb phrase for an activity row, e.g. "changed status
 * from Backlog to In Progress" or "added a comment". The caller prepends the
 * acting user's name and appends a relative timestamp.
 */
export function formatActivity(row: TicketActivity): string {
  switch (row.action) {
    case "created":
      return "created this ticket";
    case "deleted":
      return "deleted this ticket";
    case "restored":
      return "restored this ticket";

    case "cloned_from": {
      const src = row.newValue;
      const ref = src?.projectKey && typeof src.number === "number" ? `${src.projectKey}-${src.number}` : (src?.title ?? "another ticket");
      return `cloned from ${ref}`;
    }

    case "label_added":
      return `added label ${refName(row.newValue) ?? "(unknown)"}`;
    case "label_removed":
      return `removed label ${refName(row.oldValue) ?? "(unknown)"}`;

    case "comment_added":
      return "added a comment";
    case "comment_edited":
      return "edited a comment";
    case "comment_deleted":
      return "deleted a comment";

    case "link_added": {
      const linkType = (row.fieldName ?? "relates_to").replace(/_/g, " ");
      const target = row.newValue?.title ?? `#${row.newValue?.number ?? "?"}`;
      return `added link: ${linkType} ${target}`;
    }
    case "link_removed": {
      const linkType = (row.fieldName ?? "relates_to").replace(/_/g, " ");
      const target = row.oldValue?.title ?? `#${row.oldValue?.number ?? "?"}`;
      return `removed link: ${linkType} ${target}`;
    }

    case "attachment_added":
      return `attached ${row.newValue?.filename ?? "a file"}`;
    case "attachment_removed":
      return `removed attachment ${row.oldValue?.filename ?? "a file"}`;

    case "updated":
      return formatUpdate(row);
  }
}

function formatUpdate(row: TicketActivity): string {
  const field = row.fieldName;
  if (!field) return "updated this ticket";

  if (field === "title") {
    const next = row.newValue?.value;
    return next ? `renamed to "${next}"` : "renamed this ticket";
  }

  if (field === "description") {
    return "updated the description";
  }

  if (field === "priority") {
    return `changed priority from ${priorityLabel(row.oldValue)} to ${priorityLabel(row.newValue)}`;
  }

  if (field === "statusID") {
    const from = refName(row.oldValue);
    const to = refName(row.newValue);
    if (from && to) return `changed status from ${from} to ${to}`;
    if (to) return `set status to ${to}`;
    return "changed status";
  }

  if (field === "assigneeID") {
    const from = refName(row.oldValue);
    const to = refName(row.newValue);
    if (!to) return from ? `unassigned ${from}` : "removed assignee";
    if (!from) return `assigned ${to}`;
    return `reassigned from ${from} to ${to}`;
  }

  if (field === "parentID") {
    const from = refName(row.oldValue);
    const to = refName(row.newValue);
    if (!to) return "removed parent ticket";
    if (!from) return `set parent to ${to}`;
    return `changed parent from ${from} to ${to}`;
  }

  return `updated ${field.replace(/ID$/, "")}`;
}
