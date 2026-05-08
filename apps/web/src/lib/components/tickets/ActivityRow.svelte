<script lang="ts">
  import type { Label, Priority, ProjectMember, Status, TicketActivity } from "@issues/api";
  import { PRIORITIES } from "@issues/shared";
  import { formatActivity } from "$lib/activity";
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
    expandedBody?: string | null;
    expandedTombstone?: boolean;
  }

  let { row, statuses, labels, members, expandedBody = null, expandedTombstone = false }: ActivityRowProps = $props();

  function isPriority(v: string | undefined | null): v is Priority {
    return typeof v === "string" && (PRIORITIES as readonly string[]).includes(v);
  }

  function statusCategory(id: string | undefined | null): Status["category"] {
    return (id && statuses.find((s) => s.id === id)?.category) || "backlog";
  }

  function labelColour(id: string | undefined | null): string {
    return (id && labels.find((l) => l.id === id)?.colour) || "var(--colour-muted)";
  }

  function memberAvatar(id: string | undefined | null): string | null {
    if (!id) return null;
    return members.find((m) => m.user.id === id)?.user.avatarURL ?? null;
  }

  const sentence = $derived(formatActivity(row));
  const updatedField = $derived(row.action === "updated" ? row.fieldName : null);
</script>

<div class="activity-row" role="listitem">
  <div class="activity-avatar">
    <UserAvatar name={row.user.name} avatarURL={row.user.avatarURL} size="sm" />
  </div>

  <div class="activity-text">
    <span class="activity-actor">{row.user.name}</span>

    {#if row.action === "label_added" && row.newValue?.id && row.newValue?.name}
      <span class="activity-verb">added label</span>
      <LabelChip name={row.newValue.name} colour={labelColour(row.newValue.id)} />
    {:else if row.action === "label_removed" && row.oldValue?.id && row.oldValue?.name}
      <span class="activity-verb">removed label</span>
      <LabelChip name={row.oldValue.name} colour={labelColour(row.oldValue.id)} />
    {:else if updatedField === "statusID"}
      <span class="activity-verb">changed status</span>
      {#if row.oldValue?.name}
        <StatusChip name={row.oldValue.name} category={statusCategory(row.oldValue.id)} />
      {/if}
      <ArrowRight size={12} color="var(--colour-muted)" />
      {#if row.newValue?.name}
        <StatusChip name={row.newValue.name} category={statusCategory(row.newValue.id)} />
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
          <UserAvatar name={row.newValue.name ?? "?"} avatarURL={memberAvatar(row.newValue.id)} size="sm" />
          <span>{row.newValue.name}</span>
        </span>
      {:else}
        <span class="activity-verb">reassigned from</span>
        <span class="person-pill">
          <UserAvatar name={row.oldValue.name ?? "?"} avatarURL={memberAvatar(row.oldValue.id)} size="sm" />
          <span>{row.oldValue.name}</span>
        </span>
        <span class="activity-verb">to</span>
        <span class="person-pill">
          <UserAvatar name={row.newValue.name ?? "?"} avatarURL={memberAvatar(row.newValue.id)} size="sm" />
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
