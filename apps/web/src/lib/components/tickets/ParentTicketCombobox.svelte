<script lang="ts">
  import { X } from "@lucide/svelte";
  import { client } from "$lib/api/client";

  let {
    projectKey,
    value = $bindable<string | undefined>(undefined),
  }: {
    projectKey: string;
    value?: string;
  } = $props();

  let query = $state("");
  let results = $state<Array<{ id: string; number: number; title: string }>>([]);
  let loading = $state(false);
  let selected = $state<{ id: string; number: number; title: string } | null>(null);

  $effect(() => {
    const term = query.trim();
    if (selected && selected.id === value) return;

    if (term.length < 2) {
      results = [];
      loading = false;
      return;
    }

    let cancelled = false;
    loading = true;

    const timer = setTimeout(async () => {
      try {
        const res = await client.api.projects[":key"].tickets.$get({
          param: { key: projectKey },
          query: { titleSearch: term, perPage: "8" },
        });

        if (cancelled) return;

        if (res.ok) {
          const body = await res.json();
          results = body.tickets.map((ticket) => ({ id: ticket.id, number: ticket.number, title: ticket.title }));
        } else {
          results = [];
        }
      } finally {
        if (!cancelled) loading = false;
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });

  function pick(result: { id: string; number: number; title: string }) {
    selected = result;
    value = result.id;
    query = "";
    results = [];
  }

  function clear() {
    selected = null;
    value = undefined;
    query = "";
  }
</script>

<div class="input-row">
  <label class="form-label" for="parent-ticket">Parent ticket</label>

  {#if selected}
    <div class="selected-pill">
      <span class="selected-key">{projectKey}-{selected.number}</span>
      <span class="selected-title">{selected.title}</span>
      <button type="button" class="clear" onclick={clear} aria-label="Remove parent ticket">
        <X size={14} strokeWidth={2} />
      </button>
    </div>
  {:else}
    <input id="parent-ticket" class="form-input" type="text" bind:value={query} placeholder="Search tickets by title..." autocomplete="off" />

    {#if query.trim().length >= 2}
      {#if loading}
        <span class="combobox-hint">Searching...</span>
      {:else if results.length}
        <ul class="combobox-results" role="listbox" aria-label="Matching tickets">
          {#each results as ticket (ticket.id)}
            <li>
              <button type="button" onclick={() => pick(ticket)}>
                <span class="result-key">{projectKey}-{ticket.number}</span>
                <span class="result-title">{ticket.title}</span>
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <span class="combobox-hint">No matches.</span>
      {/if}
    {/if}
  {/if}
</div>

<style>
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
  }

  .clear:hover {
    background: var(--colour-bg-hover);
    color: var(--colour-text);
  }

  .combobox-hint {
    display: block;
    margin-top: 0.45em;
    color: var(--colour-muted);
    font-size: 0.8em;
  }

  .combobox-results {
    list-style: none;
    margin: 0.45em 0 0;
    padding: 0.3em;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg-lighter);
    max-height: 14em;
    overflow-y: auto;
  }

  .combobox-results button {
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
  }

  .combobox-results button:hover {
    background: var(--colour-bg-hover);
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
