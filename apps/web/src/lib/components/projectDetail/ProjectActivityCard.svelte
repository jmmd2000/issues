<script lang="ts">
  import { resolve } from "$app/paths";
  import type { Label, Priority, ProjectActivity, ProjectMember, Status } from "@issues/api";
  import LabelChip from "$lib/components/tickets/LabelChip.svelte";
  import PriorityChip from "$lib/components/tickets/PriorityChip.svelte";
  import StatusChip from "$lib/components/tickets/StatusChip.svelte";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import { asLinkType, isPriority, labelColour, memberAvatar, statusCategory } from "$lib/activity";
  import { linkLabel } from "$lib/linkLabels";
  import { formatAbsolute, timeAgo } from "$lib/time";

  interface ProjectActivityCardProps {
    row: ProjectActivity;
    projectKey: string;
    statuses: Status[];
    labels: Label[];
    members: ProjectMember[];
  }

  let { row, projectKey, statuses, labels, members }: ProjectActivityCardProps = $props();

  type TicketRef = { projectKey: string; number: number; title?: string };

  type Part =
    | { kind: "text"; value: string }
    | { kind: "status"; name: string; category: Status["category"] }
    | { kind: "priority"; priority: Priority }
    | { kind: "label"; name: string; colour: string }
    | { kind: "person"; name: string; avatarURL: string | null }
    | { kind: "ticket"; projectKey: string; number: number; title?: string };

  const hostTicket = $derived<TicketRef>({ projectKey, number: row.ticket.number, title: row.ticket.title });

  function relatedTicket(value: ProjectActivity["newValue"]): TicketRef | null {
    if (!value?.projectKey || typeof value.number !== "number") return null;
    return { projectKey: value.projectKey, number: value.number, title: value.title };
  }

  function linkParts(activity: ProjectActivity): Part[] {
    const removed = activity.action === "link_removed";
    const value = removed ? activity.oldValue : activity.newValue;
    const linkType = asLinkType(activity.fieldName);
    const direction = value?.direction ?? "outgoing";
    const phrase = linkType ? linkLabel(linkType, direction) : (activity.fieldName ?? "relates to").replace(/_/g, " ");
    const parts: Part[] = [];
    if (removed) parts.push({ kind: "text", value: "removed link · " });
    parts.push({ kind: "ticket", ...hostTicket });
    parts.push({ kind: "text", value: ` ${phrase} ` });
    const related = relatedTicket(value);
    if (related) parts.push({ kind: "ticket", ...related });
    return parts;
  }

  function clonedParts(activity: ProjectActivity): Part[] {
    const parts: Part[] = [
      { kind: "ticket", ...hostTicket },
      { kind: "text", value: " cloned from " },
    ];
    const related = relatedTicket(activity.newValue);
    if (related) parts.push({ kind: "ticket", ...related });
    return parts;
  }

  function statusParts(activity: ProjectActivity): Part[] {
    const parts: Part[] = [{ kind: "text", value: "changed status " }];
    const from = activity.oldValue;
    const to = activity.newValue;
    if (from?.name) {
      parts.push({ kind: "text", value: "from " });
      parts.push({ kind: "status", name: from.name, category: statusCategory(statuses, from.id) });
      parts.push({ kind: "text", value: " " });
    }
    if (to?.name) {
      parts.push({ kind: "text", value: "to " });
      parts.push({ kind: "status", name: to.name, category: statusCategory(statuses, to.id) });
    }
    return parts;
  }

  function priorityParts(activity: ProjectActivity): Part[] {
    const parts: Part[] = [{ kind: "text", value: "changed priority " }];
    const from = activity.oldValue?.value;
    const to = activity.newValue?.value;
    if (isPriority(from)) {
      parts.push({ kind: "text", value: "from " });
      parts.push({ kind: "priority", priority: from });
      parts.push({ kind: "text", value: " " });
    }
    if (isPriority(to)) {
      parts.push({ kind: "text", value: "to " });
      parts.push({ kind: "priority", priority: to });
    }
    return parts;
  }

  function assigneeParts(activity: ProjectActivity): Part[] {
    const from = activity.oldValue;
    const to = activity.newValue;
    if (!to) return [{ kind: "text", value: from?.name ? `unassigned ${from.name}` : "unassigned" }];
    if (!from && to.name) {
      return [
        { kind: "text", value: "assigned " },
        { kind: "person", name: to.name, avatarURL: memberAvatar(members, to.id) },
      ];
    }
    if (from?.name && to.name) {
      return [
        { kind: "text", value: "reassigned from " },
        { kind: "person", name: from.name, avatarURL: memberAvatar(members, from.id) },
        { kind: "text", value: " to " },
        { kind: "person", name: to.name, avatarURL: memberAvatar(members, to.id) },
      ];
    }
    return [{ kind: "text", value: "reassigned" }];
  }

  function labelParts(activity: ProjectActivity): Part[] {
    const added = activity.action === "label_added";
    const ref = added ? activity.newValue : activity.oldValue;
    const parts: Part[] = [{ kind: "text", value: added ? "added label " : "removed label " }];
    if (ref?.name) parts.push({ kind: "label", name: ref.name, colour: labelColour(labels, ref.id) });
    return parts;
  }

  function simpleVerb(activity: ProjectActivity): string {
    const { action, fieldName, oldValue, newValue } = activity;
    switch (action) {
      case "created":
        return "opened";
      case "deleted":
        return "deleted";
      case "restored":
        return "restored";
      case "comment_added":
        return "commented";
      case "comment_edited":
        return "edited a comment";
      case "comment_deleted":
        return "removed a comment";
      case "attachment_added":
        return newValue?.filename ? `attached ${newValue.filename}` : "attached a file";
      case "attachment_removed":
        return oldValue?.filename ? `removed ${oldValue.filename}` : "removed a file";
      case "updated": {
        if (fieldName === "title") return newValue?.value ? `renamed to "${newValue.value}"` : "renamed";
        if (fieldName === "description") return "edited the description";
        if (fieldName) return `updated ${fieldName.replace(/_/g, " ")}`;
        return "updated";
      }
      default:
        return action.replace(/_/g, " ");
    }
  }

  function buildParts(activity: ProjectActivity): Part[] {
    const { action, fieldName } = activity;

    if (action === "link_added" || action === "link_removed") return linkParts(activity);
    if (action === "cloned_from") return clonedParts(activity);

    let middle: Part[];
    if (action === "updated" && fieldName === "statusID") middle = statusParts(activity);
    else if (action === "updated" && fieldName === "priority") middle = priorityParts(activity);
    else if (action === "updated" && fieldName === "assigneeID") middle = assigneeParts(activity);
    else if (action === "label_added" || action === "label_removed") middle = labelParts(activity);
    else middle = [{ kind: "text", value: simpleVerb(activity) }];

    return [...middle, { kind: "text", value: " · " }, { kind: "ticket", ...hostTicket }];
  }

  const parts = $derived(buildParts(row));

  function ticketHref(ticket: { projectKey: string; number: number }) {
    return resolve("/projects/[key]/tickets/[num]", { key: ticket.projectKey, num: String(ticket.number) });
  }
</script>

<li class="card">
  <UserAvatar name={row.user.name} avatarURL={row.user.avatarURL} size="sm" />
  <div class="head">
    <span class="actor">{row.user.name}</span>
    <time class="when" datetime={row.createdAt} title={formatAbsolute(row.createdAt)}>{timeAgo(row.createdAt)}</time>
  </div>
  <div class="content">
    {#each parts as part, i (i)}
      {#if part.kind === "text"}
        <span class="text">{part.value}</span>
      {:else if part.kind === "status"}
        <StatusChip name={part.name} category={part.category} />
      {:else if part.kind === "priority"}
        <PriorityChip priority={part.priority} variant="chip" />
      {:else if part.kind === "label"}
        <LabelChip name={part.name} colour={part.colour} />
      {:else if part.kind === "person"}
        <span class="person">
          <UserAvatar name={part.name} avatarURL={part.avatarURL} size="sm" />
          <span>{part.name}</span>
        </span>
      {:else if part.kind === "ticket"}
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
        <a class="ticket-pill" href={ticketHref(part)} title={part.title ?? ""}>{part.projectKey}-{part.number}</a>
      {/if}
    {/each}
  </div>
</li>

<style>
  .card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-rows: auto auto;
    column-gap: 0.7rem;
    row-gap: 0.4rem;
    padding: 0.8rem 0.9rem;
    background: var(--colour-bg-lighter);
    border: var(--border);
    border-radius: var(--border-radius-inner);

    :global(.avatar) {
      grid-row: 1;
      align-self: center;
    }
  }

  .head {
    grid-column: 2;
    grid-row: 1;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.6em;
    min-width: 0;

    .actor {
      color: var(--colour-text);
      font-weight: 600;
      font-size: 0.9em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .when {
      color: var(--colour-muted);
      font-size: 0.8em;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      flex-shrink: 0;
    }
  }

  .content {
    grid-column: 1 / -1;
    grid-row: 2;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35em;
    color: var(--colour-text-secondary);
    font-size: 0.85em;
    line-height: 1.55;

    .text {
      overflow-wrap: anywhere;
    }
  }

  .ticket-pill {
    display: inline-flex;
    align-items: center;
    padding: 0.1rem 0.45rem;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg);
    color: var(--accent-base);
    font-family: var(--font-mono);
    font-size: 0.85em;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;

    &:hover {
      background: var(--accent-tint-900);
      border-color: var(--accent-tint-600);
    }
  }

  .person {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.1rem 0.5rem 0.1rem 0.2rem;
    border: var(--border);
    border-radius: 999px;
    background: var(--colour-bg);
    color: var(--colour-text);
    font-size: 0.85em;
    font-weight: 600;
    white-space: nowrap;
  }
</style>
