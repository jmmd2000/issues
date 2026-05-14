<script lang="ts">
  import type { ProjectMember, Status, Ticket } from "@issues/api";
  import { dndzone, type DndEvent } from "svelte-dnd-action";
  import TicketCard from "./TicketCard.svelte";

  let {
    projectKey,
    status,
    tickets,
    members,
    canEdit = true,
    onConsider,
    onFinalize,
  }: {
    projectKey: string;
    status: Status;
    tickets: Ticket[];
    members: ProjectMember[];
    canEdit?: boolean;
    onConsider: (statusID: string, items: Ticket[]) => void;
    onFinalize: (statusID: string, items: Ticket[], info: DndEvent<Ticket>["info"]) => void;
  } = $props();

  function handleConsider(e: CustomEvent<DndEvent<Ticket>>) {
    onConsider(status.id, e.detail.items);
  }

  function handleFinalize(e: CustomEvent<DndEvent<Ticket>>) {
    onFinalize(status.id, e.detail.items, e.detail.info);
  }
</script>

<section class="column" aria-label="{status.name} column">
  <header class="column-header">
    <span class="name">{status.name}</span>
    <span class="count">{tickets.length}</span>
  </header>
  <div class="cards-wrap">
    <div
      class="cards"
      data-empty={tickets.length === 0}
      use:dndzone={{
        items: tickets,
        type: "ticket",
        flipDurationMs: 120,
        dropTargetStyle: {},
        dragDisabled: !canEdit,
      }}
      onconsider={handleConsider}
      onfinalize={handleFinalize}
    >
      {#each tickets as ticket (ticket.id)}
        <TicketCard {projectKey} {ticket} {members} />
      {/each}
    </div>
    {#if tickets.length === 0}
      <div class="empty">No tickets</div>
    {/if}
  </div>
</section>

<style>
  .column {
    --ticket-drop-target-height: 4.25rem;

    display: flex;
    flex-direction: column;
    background: var(--colour-bg);
    border: var(--border);
    border-radius: var(--border-radius-inner);
    flex: 1 1 0;
    min-width: 16rem;
  }

  .column-header {
    display: flex;
    align-items: center;
    gap: 0.45em;
    padding: 0.5em 0.7em;
    border-bottom: var(--border);
    background: var(--colour-bg-lighter);
    border-top-left-radius: var(--border-radius-inner);
    border-top-right-radius: var(--border-radius-inner);

    .name {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--colour-text);
      flex: 1;
    }

    .count {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--colour-muted);
    }
  }

  .cards-wrap {
    position: relative;
    flex: 1;
  }

  .cards {
    display: flex;
    flex-direction: column;
    justify-content: start;
    gap: 0.4em;
    padding: 0.45em;
  }

  .cards[data-empty="true"] {
    min-height: var(--ticket-drop-target-height);
  }

  .cards :global([data-is-dnd-shadow-item-internal="true"]) {
    visibility: visible !important;
    min-height: var(--ticket-drop-target-height);
    border: 1px dashed var(--colour-border) !important;
    background: color-mix(in oklch, var(--accent-base) 5%, white 95%) !important;
    box-shadow: none !important;
    opacity: 1 !important;
    outline: none !important;
  }

  .cards :global([data-is-dnd-shadow-item-internal="true"] *) {
    visibility: hidden !important;
  }

  .empty {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    font-size: 0.75em;
    color: var(--colour-muted);
    text-align: center;
  }
</style>
