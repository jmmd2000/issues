<script lang="ts" module>
  export type TicketRef = { id: string; number: number; title: string };
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import { X } from "@lucide/svelte";
  import { createTicketSearch } from "$lib/api/ticketSearch.svelte";

  let {
    projectKey,
    excludeTicketNumber,
    includeClosed = false,
    selected = null,
    onpicked,
    oncleared,
    placeholder = "Search tickets by title...",
    inputID,
    disabled = false,
    pill,
  }: {
    projectKey: string;
    /** Excludes the given ticket number from the results (e.g. the current ticket). */
    excludeTicketNumber?: number;
    /** When true, includes done/cancelled tickets in the search. */
    includeClosed?: boolean;
    /** The currently selected ticket. When non-null the pill renders instead of the input. Controlled by the consumer. */
    selected?: TicketRef | null;
    /** Fires when the user picks a result from the dropdown. The consumer must update `selected` in response. */
    onpicked: (ticket: TicketRef) => void;
    /** Fires when the user clicks the pill's clear button. Optional - omit if the consumer handles clearing differently. */
    oncleared?: () => void;
    placeholder?: string;
    inputID?: string;
    disabled?: boolean;
    /** Optional snippet to render the selection pill. Default uses a key/title/clear pill matching the rest of the app. */
    pill?: Snippet<[{ ticket: TicketRef; clear: () => void }]>;
  } = $props();

  let query = $state("");

  const search = createTicketSearch<TicketRef>({
    projectKey: () => projectKey,
    query: () => query,
    enabled: () => !selected,
    includeClosed: () => includeClosed,
    excludeNumbers: () => (excludeTicketNumber !== undefined ? [excludeTicketNumber] : []),
    mapper: (ticket) => ({ id: ticket.id, number: ticket.number, title: ticket.title }),
  });

  function pick(ticket: TicketRef) {
    if (disabled) return;
    onpicked(ticket);
    query = "";
    search.reset();
  }

  function clear() {
    if (disabled) return;
    oncleared?.();
    query = "";
    search.reset();
  }
</script>

{#if selected}
  {#if pill}
    {@render pill({ ticket: selected, clear })}
  {:else}
    <div class="selected-pill">
      <span class="selected-key">{projectKey}-{selected.number}</span>
      <span class="selected-title">{selected.title}</span>
      <button type="button" class="clear" onclick={clear} aria-label="Clear selected ticket" {disabled}>
        <X size={14} strokeWidth={2} />
      </button>
    </div>
  {/if}
{:else}
  <div class="search-wrap">
    <input
      id={inputID}
      class="search-input"
      type="text"
      bind:value={query}
      {placeholder}
      autocomplete="off"
      aria-label={placeholder}
      {disabled}
    />

    {#if query.trim().length >= 2}
      {#if search.loading}
        <span class="hint">Searching...</span>
      {:else if search.results.length}
        <ul class="results" role="listbox" aria-label="Matching tickets">
          {#each search.results as ticket (ticket.id)}
            <li>
              <button type="button" onclick={() => pick(ticket)}>
                <span class="result-key">{projectKey}-{ticket.number}</span>
                <span class="result-title">{ticket.title}</span>
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <span class="hint">No matches.</span>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .search-wrap {
    position: relative;
  }

  .search-input {
    width: 100%;
    padding: 0.4em 0.6em;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg);
    color: var(--colour-text);
    font: inherit;
    font-size: 0.85em;

    &::placeholder {
      color: var(--colour-muted);
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.65;
    }
  }

  .selected-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.6em;
    padding: 0.45em 0.55em 0.45em 0.7em;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg);
    font-size: 0.85em;
    width: fit-content;
    max-width: 100%;
  }

  .selected-key {
    font-family: var(--font-mono);
    color: var(--accent-base);
    font-weight: 600;
  }

  .selected-title {
    color: var(--colour-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .clear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5em;
    height: 1.5em;
    padding: 0;
    border: none;
    border-radius: var(--border-radius-inner);
    background: transparent;
    color: var(--colour-text-secondary);
    cursor: pointer;

    &:hover:not(:disabled) {
      background: var(--colour-bg-hover);
      color: var(--colour-text);
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.65;
    }
  }

  .hint {
    display: block;
    margin-top: 0.45em;
    color: var(--colour-muted);
    font-size: 0.8em;
  }

  .results {
    list-style: none;
    margin: 0.45em 0 0;
    padding: 0.3em;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg-lighter);
    max-height: 14em;
    overflow-y: auto;

    & button {
      display: flex;
      align-items: baseline;
      gap: 0.6em;
      width: 100%;
      padding: 0.45em 0.6em;
      border: none;
      border-radius: var(--border-radius-inner);
      background: transparent;
      color: var(--colour-text);
      text-align: left;
      cursor: pointer;
      font-family: inherit;
      font-size: 0.85em;

      &:hover {
        background: var(--colour-bg-hover);
      }
    }
  }

  .result-key {
    font-family: var(--font-mono);
    color: var(--accent-base);
    font-weight: 600;
    flex-shrink: 0;
  }

  .result-title {
    color: var(--colour-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
