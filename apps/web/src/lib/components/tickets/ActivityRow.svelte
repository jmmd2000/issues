<script lang="ts">
  import { resolve } from "$app/paths";
  import type { Label, ProjectMember, Status, TicketActivity } from "@issues/api";
  import { asLinkType, formatActivity, isPriority, labelColour, memberAvatar, statusCategory } from "$lib/activity";
  import { linkLabel } from "$lib/linkLabels";
  import { formatAbsolute, timeAgo } from "$lib/time";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import MarkdownRenderer from "$lib/components/markdown/MarkdownRenderer.svelte";
  import LabelChip from "./LabelChip.svelte";
  import StatusChip from "./StatusChip.svelte";
  import PriorityChip from "./PriorityChip.svelte";
  import { ArrowRight } from "@lucide/svelte";

  interface ActivityRowProps {
    row: TicketActivity;
    statuses: Status[];
    labels: Label[];
    members: ProjectMember[];
    /** When set, renders a small ticket link between the actor and the verb. Used by the project-scoped feed. */
    ticketRef?: { projectKey: string; number: number; title: string } | null;
    expandedBody?: string | null;
    expandedTombstone?: boolean;
  }

  let { row, statuses, labels, members, ticketRef = null, expandedBody = null, expandedTombstone = false }: ActivityRowProps = $props();

  const sentence = $derived(formatActivity(row));
  const updatedField = $derived(row.action === "updated" ? row.fieldName : null);
</script>

<div class="activity-row" role="listitem">
  <div class="activity-avatar">
    <UserAvatar name={row.user.name} avatarURL={row.user.avatarURL} size="sm" />
  </div>

  <div class="activity-text">
    <span class="activity-actor">{row.user.name}</span>

    {#if ticketRef}
      <a class="ticket-pill" href={resolve("/projects/[key]/tickets/[num]", { key: ticketRef.projectKey, num: String(ticketRef.number) })} title={ticketRef.title}>
        {ticketRef.projectKey}-{ticketRef.number}
      </a>
    {/if}

    {#if row.action === "link_added" && row.newValue}
      {@const linkType = asLinkType(row.fieldName)}
      {@const direction = row.newValue.direction ?? "outgoing"}
      <span class="activity-verb">added link · {linkType ? linkLabel(linkType, direction) : (row.fieldName ?? "")}</span>
      {#if row.newValue.projectKey && row.newValue.number != null}
        <a class="ticket-pill" href={resolve("/projects/[key]/tickets/[num]", { key: row.newValue.projectKey, num: String(row.newValue.number) })} title={row.newValue.title ?? ""}>
          {row.newValue.projectKey}-{row.newValue.number}
        </a>
      {/if}
    {:else if row.action === "link_removed" && row.oldValue}
      {@const linkType = asLinkType(row.fieldName)}
      {@const direction = row.oldValue.direction ?? "outgoing"}
      <span class="activity-verb">removed link · {linkType ? linkLabel(linkType, direction) : (row.fieldName ?? "")}</span>
      {#if row.oldValue.projectKey && row.oldValue.number != null}
        <a class="ticket-pill" href={resolve("/projects/[key]/tickets/[num]", { key: row.oldValue.projectKey, num: String(row.oldValue.number) })} title={row.oldValue.title ?? ""}>
          {row.oldValue.projectKey}-{row.oldValue.number}
        </a>
      {/if}
    {:else if row.action === "label_added" && row.newValue?.id && row.newValue?.name}
      <span class="activity-verb">added label</span>
      <LabelChip name={row.newValue.name} colour={labelColour(labels, row.newValue.id)} />
    {:else if row.action === "label_removed" && row.oldValue?.id && row.oldValue?.name}
      <span class="activity-verb">removed label</span>
      <LabelChip name={row.oldValue.name} colour={labelColour(labels, row.oldValue.id)} />
    {:else if updatedField === "statusID"}
      <span class="activity-verb">changed status</span>
      {#if row.oldValue?.name}
        <StatusChip name={row.oldValue.name} category={statusCategory(statuses, row.oldValue.id)} />
      {/if}
      <ArrowRight size={12} color="var(--colour-muted)" />
      {#if row.newValue?.name}
        <StatusChip name={row.newValue.name} category={statusCategory(statuses, row.newValue.id)} />
      {/if}
    {:else if updatedField === "priority"}
      <span class="activity-verb">changed priority</span>
      {#if isPriority(row.oldValue?.value)}
        <PriorityChip priority={row.oldValue.value} variant="chip" />
      {/if}
      <ArrowRight size={12} color="var(--colour-muted)" />
      {#if isPriority(row.newValue?.value)}
        <PriorityChip priority={row.newValue.value} variant="chip" />
      {/if}
    {:else if updatedField === "assigneeID"}
      {#if !row.newValue}
        <span class="activity-verb">unassigned{row.oldValue?.name ? ` ${row.oldValue.name}` : ""}</span>
      {:else if !row.oldValue}
        <span class="activity-verb">assigned</span>
        <span class="person-pill">
          <UserAvatar name={row.newValue.name ?? "?"} avatarURL={memberAvatar(members, row.newValue.id)} size="sm" />
          <span>{row.newValue.name}</span>
        </span>
      {:else}
        <span class="activity-verb">reassigned from</span>
        <span class="person-pill">
          <UserAvatar name={row.oldValue.name ?? "?"} avatarURL={memberAvatar(members, row.oldValue.id)} size="sm" />
          <span>{row.oldValue.name}</span>
        </span>
        <span class="activity-verb">to</span>
        <span class="person-pill">
          <UserAvatar name={row.newValue.name ?? "?"} avatarURL={memberAvatar(members, row.newValue.id)} size="sm" />
          <span>{row.newValue.name}</span>
        </span>
      {/if}
    {:else}
      <span class="activity-verb">{sentence}</span>
    {/if}
  </div>

  <time class="activity-time" datetime={row.createdAt} title={formatAbsolute(row.createdAt)}>{timeAgo(row.createdAt)}</time>

  {#if expandedBody}
    <div class="activity-expanded">
      <MarkdownRenderer source={expandedBody} />
    </div>
  {:else if expandedTombstone}
    <p class="activity-tombstone">Comment deleted.</p>
  {/if}
</div>

<style>
  .activity-row {
    padding: 0.5rem 0;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    column-gap: 0.55rem;
    row-gap: 0.4rem;
    align-items: center;
    font-size: 0.8rem;
    line-height: 1.35;
    color: var(--colour-text-secondary);
  }

  .activity-avatar {
    display: flex;
    align-items: center;
  }

  .activity-text {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
  }

  .activity-actor {
    color: var(--colour-text);
    font-weight: 700;
  }

  .activity-verb {
    color: var(--colour-text-secondary);
  }

  .activity-time {
    color: var(--colour-muted);
    font-size: 0.75rem;
    white-space: nowrap;
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
    font-size: 0.7rem;
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;

    &:hover {
      background: var(--accent-tint-900);
      border-color: var(--accent-tint-600);
    }
  }

  .person-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.1rem 0.5rem 0.1rem 0.2rem;
    border: var(--border);
    border-radius: 999px;
    background: var(--colour-bg);
    color: var(--colour-text);
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .activity-expanded {
    grid-column: 2 / -1;
    border-left: 2px solid var(--colour-border);
    padding: 0.2rem 0 0.2rem 0.7rem;
    color: var(--colour-text);
  }

  .activity-tombstone {
    grid-column: 2 / -1;
    margin: 0;
    font-size: 0.8rem;
    color: var(--colour-muted);
    font-style: italic;
  }
</style>
