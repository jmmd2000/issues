<script lang="ts">
  import { tick } from "svelte";
  import type { ProjectMember, Status } from "@issues/api";
  import Button from "$lib/components/ui/Button.svelte";
  import Modal from "$lib/components/ui/Modal.svelte";
  import TicketRow from "./TicketRow.svelte";
  import type { TicketRef } from "./TicketSearchCombobox.svelte";
  import { createTicketSearch } from "$lib/api/ticketSearch.svelte";

  interface TicketSearchModalProps {
    open: boolean;
    title: string;
    projectKey: string;
    statuses: Status[];
    members: ProjectMember[];
    /** Tickets whose number appears here are excluded from the result list. */
    excludeTicketNumbers?: number[];
    /** When true, includes done/cancelled tickets in the search. */
    includeClosed?: boolean;
    onpicked: (ticket: TicketRef) => void;
    onclose: () => void;
    /** Optional secondary action rendered alongside Cancel (e.g. "+ Create new sub-ticket"). */
    primaryAction?: { label: string; run: () => void };
  }

  let { open, title, projectKey, statuses, members, excludeTicketNumbers, includeClosed = false, onpicked, onclose, primaryAction }: TicketSearchModalProps = $props();

  let query = $state("");
  let inputElement: HTMLInputElement | null = $state(null);

  const statusByID = $derived(new Map(statuses.map((s) => [s.id, s])));
  const memberByID = $derived(new Map(members.map((m) => [m.userID, m])));

  const search = createTicketSearch({
    projectKey: () => projectKey,
    query: () => query,
    enabled: () => open,
    includeClosed: () => includeClosed,
    excludeNumbers: () => excludeTicketNumbers ?? [],
    mapper: (ticket) => ({
      id: ticket.id,
      number: ticket.number,
      title: ticket.title,
      statusID: ticket.statusID,
      priority: ticket.priority,
      assigneeID: ticket.assigneeID,
    }),
  });

  // Reset state and focus the input each time the modal opens. Avoids stale
  // results lingering between invocations.
  $effect(() => {
    if (open) {
      query = "";
      search.reset();
      void tick().then(() => inputElement?.focus());
    }
  });

  function pick(ticket: { id: string; number: number; title: string }) {
    onpicked({ id: ticket.id, number: ticket.number, title: ticket.title });
  }
</script>

<Modal {open} {title} {onclose} maxWidth="34rem">
  <div class="search-panel">
    <input
      bind:this={inputElement}
      class="search-input"
      type="text"
      bind:value={query}
      placeholder="Search tickets by title..."
      autocomplete="off"
      aria-label="Search tickets by title"
    />

    <div class="results-area" aria-live="polite">
      {#if query.trim().length < 2}
        <p class="hint">Type at least 2 characters.</p>
      {:else if search.loading}
        <p class="hint">Searching...</p>
      {:else if search.results.length === 0}
        <p class="hint">No matches.</p>
      {:else}
        <ul class="results" role="listbox" aria-label="Matching tickets">
          {#each search.results as result (result.id)}
            {@const status = statusByID.get(result.statusID)}
            {@const member = result.assigneeID ? (memberByID.get(result.assigneeID) ?? null) : null}
            <li>
              <TicketRow
                ticket={{ id: result.id, number: result.number, title: result.title, projectKey }}
                status={status ? { name: status.name, category: status.category } : { name: "Unknown", category: "backlog" }}
                priority={result.priority}
                assignee={member ? { name: member.user.name, avatarURL: member.user.avatarURL } : null}
                onclick={() => pick(result)}
              />
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>

  {#snippet footer()}
    <Button type="button" variant="secondary" onclick={onclose}>Cancel</Button>
    {#if primaryAction}
      <Button type="button" onclick={primaryAction.run}>{primaryAction.label}</Button>
    {/if}
  {/snippet}
</Modal>

<style>
  .search-panel {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .search-input {
    width: 100%;
    padding: 0.5rem 0.7rem;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg);
    color: var(--colour-text);
    font: inherit;
    font-size: 0.85rem;

    &::placeholder {
      color: var(--colour-muted);
    }
  }

  .results-area {
    min-height: 6rem;
    max-height: 22rem;
    overflow-y: auto;
  }

  .hint {
    margin: 0;
    padding: 1rem 0.5rem;
    color: var(--colour-muted);
    font-size: 0.85rem;
    text-align: center;
  }

  .results {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
</style>
