<script lang="ts">
  import { resolve } from "$app/paths";
  import type { ProjectMember, Status, Ticket } from "@issues/api";
  import { CircleCheck, CircleSlash, UserRound } from "@lucide/svelte";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import PriorityChip from "../tickets/PriorityChip.svelte";
  import { formatAbsolute, timeAgo } from "$lib/time";

  interface TicketCardProps {
    projectKey: string;
    ticket: Ticket;
    members: ProjectMember[];
    /** The category of the column the card sits in. Done and cancelled cards are dimmed and show an icon. */
    category?: Status["category"];
  }

  let { projectKey, ticket, members, category }: TicketCardProps = $props();

  const closedState = $derived(category === "done" || category === "cancelled" ? category : null);

  const assignee = $derived(ticket.assigneeID ? (members.find(member => member.userID === ticket.assigneeID) ?? null) : null);

  let pointerStart: { x: number; y: number } | null = null;
  let movedPointer = false;

  function handlePointerdown(event: PointerEvent) {
    pointerStart = { x: event.clientX, y: event.clientY };
    movedPointer = false;
  }

  function handlePointermove(event: PointerEvent) {
    if (!pointerStart) return;
    movedPointer = Math.abs(event.clientX - pointerStart.x) > 4 || Math.abs(event.clientY - pointerStart.y) > 4;
  }

  function handleClick(event: MouseEvent) {
    if (!movedPointer) return;
    event.preventDefault();
    movedPointer = false;
  }
</script>

<a
  class="card"
  href={resolve("/projects/[key]/tickets/[num]", { key: projectKey, num: String(ticket.number) })}
  data-state={closedState}
  aria-label={`${projectKey}-${ticket.number}: ${ticket.title}${closedState ? `, ${closedState}` : ""}`}
  draggable="false"
  onpointerdown={handlePointerdown}
  onpointermove={handlePointermove}
  onclick={handleClick}
>
  <span class="number">
    {#if closedState === "done"}<CircleCheck size={12} strokeWidth={2.25} aria-hidden="true" />{:else if closedState === "cancelled"}<CircleSlash
        size={12}
        strokeWidth={2.25}
        aria-hidden="true"
      />{/if}
    {projectKey}-{ticket.number}
  </span>
  <h4 class="title">{ticket.title}</h4>

  <div class="footer">
    <div class="meta">
      <PriorityChip priority={ticket.priority} />
      <time class="when" datetime={ticket.updatedAt} title={formatAbsolute(ticket.updatedAt)}>{timeAgo(ticket.updatedAt)}</time>
    </div>

    {#if assignee}
      <span class="assignee" title={assignee.user.name}>
        <UserAvatar name={assignee.user.name} avatarURL={assignee.user.avatarURL} size="sm" />
      </span>
    {:else}
      <span class="unassigned" title="Unassigned" aria-label="Unassigned">
        <UserRound size={13} strokeWidth={2} />
      </span>
    {/if}
  </div>
</a>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.55rem 0.65rem;
    background: var(--colour-bg-lighter);
    border: var(--border);
    border-radius: var(--border-radius-inner);
    color: var(--colour-text);
    cursor: grab;
    text-decoration: none;
    user-select: none;
    transition:
      border-color 0.12s,
      transform 0.08s;

    &:hover {
      border-color: color-mix(in oklab, var(--accent-base) 30%, var(--colour-paper) 70%);
    }

    &:active {
      cursor: grabbing;
      transform: translateY(1px);
    }
  }

  .number {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--accent-base);
    letter-spacing: 0.02em;
    white-space: nowrap;
  }

  .title {
    margin: 0;
    overflow: hidden;
    color: var(--colour-text);
    display: -webkit-box;
    font-size: 0.85rem;
    font-weight: 500;
    line-height: 1.35;
    overflow-wrap: anywhere;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    transition: color var(--motion-base) var(--ease-out-quart);
  }

  .card[data-state="done"] .title {
    color: var(--colour-text-secondary);
  }

  .card[data-state="cancelled"] .title {
    color: var(--colour-muted);
  }

  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    min-width: 0;
    min-height: 1.2rem;

    .meta {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      min-width: 0;
    }

    .when {
      font-size: 0.7rem;
      color: var(--colour-muted);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
  }

  .assignee {
    display: inline-flex;
    flex: 0 0 auto;

    :global(.avatar) {
      width: 1.25rem;
      height: 1.25rem;
      font-size: 0.6rem;
    }
  }

  .unassigned {
    display: inline-grid;
    place-items: center;
    flex: 0 0 auto;
    width: 1.25rem;
    height: 1.25rem;
    border: var(--border);
    border-radius: 50%;
    background: var(--colour-bg);
    color: var(--colour-muted);
  }
</style>
