<script lang="ts">
  import type { ProjectMember, Ticket } from "@issues/api";
  import { X } from "@lucide/svelte";
  import { dndzone, type DndEvent } from "svelte-dnd-action";
  import SearchInput from "$lib/components/ui/SearchInput.svelte";
  import TicketCard from "./TicketCard.svelte";

  let {
    projectKey,
    tickets,
    members,
    onConsider,
    onFinalize,
    onClose,
  }: {
    projectKey: string;
    tickets: Ticket[];
    members: ProjectMember[];
    onConsider: (items: Ticket[]) => void;
    onFinalize: (items: Ticket[], info: DndEvent<Ticket>["info"]) => void;
    onClose: () => void;
  } = $props();

  let query = $state("");

  const visibleTickets = $derived.by(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return tickets;
    return tickets.filter((ticket) => ticket.title.toLowerCase().includes(needle));
  });

  function handleConsider(event: CustomEvent<DndEvent<Ticket>>) {
    onConsider(event.detail.items);
  }

  function handleFinalize(event: CustomEvent<DndEvent<Ticket>>) {
    onFinalize(event.detail.items, event.detail.info);
  }
</script>

<aside class="drawer" aria-label="Backlog">
  <header class="drawer-header">
    <div class="title">
      <span class="name">Backlog</span>
      <span class="count">{tickets.length}</span>
    </div>
    <button type="button" class="close" onclick={onClose} aria-label="Close backlog">
      <X size={14} strokeWidth={2.25} />
    </button>
  </header>

  <div class="search">
    <SearchInput bind:value={query} placeholder="Search backlog…" ariaLabel="Search backlog by title" />
  </div>

  <div
    class="cards"
    data-empty={visibleTickets.length === 0}
    use:dndzone={{
      items: visibleTickets,
      type: "ticket",
      flipDurationMs: 120,
      dropTargetStyle: {},
    }}
    onconsider={handleConsider}
    onfinalize={handleFinalize}
  >
    {#each visibleTickets as ticket (ticket.id)}
      <TicketCard {projectKey} {ticket} {members} />
    {/each}
  </div>

  {#if visibleTickets.length === 0}
    <p class="empty">{query ? "No backlog tickets match." : "Backlog is empty."}</p>
  {/if}
</aside>

<style>
  .drawer {
    position: fixed;
    top: 5rem;
    right: 1rem;
    bottom: 1rem;
    width: 22em;
    max-width: calc(100vw - 2rem);
    display: flex;
    flex-direction: column;
    padding: 0.75em;
    border: var(--border);
    border-radius: var(--border-radius-outer);
    background: var(--colour-bg-lighter);
    box-shadow:
      0 4px 16px rgb(from var(--colour-text) r g b / 0.1),
      var(--box-shadow);
    z-index: 50;
    overflow: hidden;
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 0.25em 0.6em;
    border-bottom: var(--border);
    margin-bottom: 0.55em;
  }

  .title {
    display: inline-flex;
    align-items: center;
    gap: 0.5em;
    font-size: 0.8em;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .name {
    color: var(--accent-base);
  }

  .count {
    font-family: var(--font-mono);
    font-weight: 500;
    color: var(--colour-text-secondary);
  }

  .close {
    display: inline-grid;
    place-items: center;
    width: 1.6em;
    height: 1.6em;
    padding: 0;
    border: none;
    border-radius: var(--border-radius-inner);
    background: transparent;
    color: var(--colour-text-secondary);
    cursor: pointer;
  }

  .close:hover,
  .close:focus-visible {
    background: var(--colour-bg-hover);
    color: var(--colour-text);
  }

  .search {
    margin-bottom: 0.55em;
  }

  .cards {
    display: flex;
    flex-direction: column;
    gap: 0.4em;
    overflow-y: auto;
    flex: 1 1 auto;
    min-height: 0;
    padding-right: 0.15em;
  }

  .cards > :global(*) {
    flex-shrink: 0;
  }

  .cards[data-empty="true"] {
    min-height: 4.25rem;
  }

  .cards :global([data-is-dnd-shadow-item-internal="true"]) {
    --priority-colour: transparent !important;

    visibility: visible !important;
    min-height: 4.25rem;
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
    margin: 0.5em 0 0;
    padding: 0.5em 0.25em;
    font-size: 0.8em;
    color: var(--colour-muted);
    text-align: center;
  }
</style>
