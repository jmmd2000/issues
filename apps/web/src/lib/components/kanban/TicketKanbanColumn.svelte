<script lang="ts">
  import type { Status, Ticket } from "@issues/api";
  import { dndzone, type DndEvent } from "svelte-dnd-action";
  import TicketCard from "./TicketCard.svelte";

  let {
    projectKey,
    status,
    tickets,
    onConsider,
    onFinalize,
  }: {
    projectKey: string;
    status: Status;
    tickets: Ticket[];
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
        <TicketCard {projectKey} {ticket} />
      {/each}
    </div>
    {#if tickets.length === 0}
      <div class="empty">No tickets</div>
    {/if}
  </div>
</section>

<style>
  .column {
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
    min-height: 6em;
  }

  .cards {
    display: flex;
    flex-direction: column;
    justify-content: start;
    gap: 0.45em;
    min-height: 6em;
  }

  .cards :global([data-is-dnd-shadow-item-internal="true"]) {
    visibility: visible !important;
    box-shadow: inset 0 0 0 999px var(--accent-tint-800) !important;
    outline: none !important;
  }

  .cards :global([data-is-dnd-shadow-item-internal="true"] > *) {
    visibility: hidden;
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
