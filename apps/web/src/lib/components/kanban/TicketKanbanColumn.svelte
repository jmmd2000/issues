<script lang="ts">
  import type { ProjectMember, Status, Ticket } from "@issues/api";
  import { dndzone, type DndEvent } from "svelte-dnd-action";
  import TicketCard from "./TicketCard.svelte";

  let {
    projectKey,
    status,
    tickets,
    members,
    onConsider,
    onFinalize,
  }: {
    projectKey: string;
    status: Status;
    tickets: Ticket[];
    members: ProjectMember[];
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
    justify-content: center;
    gap: 0.6em;
    padding: 0.75em;
    border: var(--border);
    border-radius: var(--border-radius-outer);
    background-color: var(--colour-bg-lighter);
    min-width: 14em;
    max-width: 20em;
    flex: 1 1 17.5em;
  }

  .column-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.75em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--colour-muted);
    padding: 0 0.25em 0.25em;
  }

  .name {
    color: var(--accent-base);
  }

  .count {
    font-family: var(--font-mono);
    font-weight: 500;
    color: var(--colour-text-secondary);
  }

  .cards-wrap {
    position: relative;
  }

  .cards {
    display: flex;
    flex-direction: column;
    justify-content: start;
    gap: 0.45em;
  }

  .cards[data-empty="true"] {
    min-height: var(--ticket-drop-target-height);
  }

  .cards :global([data-is-dnd-shadow-item-internal="true"]) {
    --priority-colour: transparent !important;

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
