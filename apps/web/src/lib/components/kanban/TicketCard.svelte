<script lang="ts">
  import { resolve } from "$app/paths";
  import type { ProjectMember, Ticket } from "@issues/api";
  import { UserRound } from "@lucide/svelte";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import PriorityChip from "../tickets/PriorityChip.svelte";

  let { projectKey, ticket, members }: { projectKey: string; ticket: Ticket; members: ProjectMember[] } = $props();

  const assignee = $derived(ticket.assigneeID ? (members.find((member) => member.userID === ticket.assigneeID) ?? null) : null);

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
  style:--priority-colour={`var(--colour-priority-${ticket.priority})`}
  aria-label={`Open ${projectKey}-${ticket.number}: ${ticket.title}`}
  draggable="false"
  onpointerdown={handlePointerdown}
  onpointermove={handlePointermove}
  onclick={handleClick}
>
  <h4 class="title">{ticket.title}</h4>

  <div class="footer">
    <div class="meta">
      <span class="number">{projectKey}-{ticket.number}</span>
      <PriorityChip priority={ticket.priority} />
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
    --priority-colour: var(--colour-priority-none);

    position: relative;
    display: grid;
    gap: 0.55rem;
    padding: 0.65rem 0.7rem 0.65rem 0.85rem;
    overflow: hidden;
    background: var(--colour-bg-lighter);
    border: 1px solid var(--colour-border);
    border-radius: var(--border-radius-inner);
    box-shadow: var(--box-shadow);
    color: inherit;
    cursor: grab;
    text-decoration: none;
    user-select: none;
    transition:
      background 0.12s,
      border-color 0.12s,
      box-shadow 0.12s,
      transform 0.08s;

    &::before {
      content: "";
      position: absolute;
      inset: 0 auto 0 0;
      width: 3px;
      background: var(--priority-colour);
    }

    &:hover {
      background: color-mix(in oklch, var(--colour-bg-lighter) 72%, white 28%);
      border-color: var(--colour-border);
      box-shadow: var(--box-shadow);
    }

    &:active {
      cursor: grabbing;
      transform: translateY(1px);
    }
  }

  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    min-width: 0;
  }

  .meta {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
  }

  .number {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--accent-base);
    letter-spacing: 0.01em;
    white-space: nowrap;
  }

  .title {
    margin: 0;
    overflow: hidden;
    color: var(--colour-text);
    display: -webkit-box;
    font-size: 0.8rem;
    font-weight: 650;
    line-height: 1.4;
    overflow-wrap: anywhere;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
  }

  .assignee {
    display: inline-flex;
    flex: 0 0 auto;
  }

  .assignee :global(.avatar) {
    width: 1.25rem;
    height: 1.25rem;
    font-size: 0.6rem;
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
