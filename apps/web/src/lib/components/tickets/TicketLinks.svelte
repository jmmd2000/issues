<script lang="ts">
  import { resolve } from "$app/paths";
  import { Plus, X } from "@lucide/svelte";
  import type { TicketLink } from "@issues/api";
  import Button from "$lib/components/ui/Button.svelte";
  import { client } from "$lib/api/client";
  import { LINK_OPTIONS, linkLabel } from "$lib/linkLabels";

  interface TicketLinksProps {
    links: TicketLink[];
    projectKey: string;
    ticketNumber: number;
    onmutated: () => void | Promise<void>;
  }

  let { links, projectKey, ticketNumber, onmutated }: TicketLinksProps = $props();

  type SearchResult = { id: string; number: number; title: string };

  let adding = $state(false);
  let optionKey = $state<string>(LINK_OPTIONS[0].key);
  let query = $state("");
  let results = $state<SearchResult[]>([]);
  let searching = $state(false);
  let selected = $state<SearchResult | null>(null);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let deletingID = $state<string | null>(null);

  const selectedOption = $derived(LINK_OPTIONS.find((option) => option.key === optionKey) ?? LINK_OPTIONS[0]);

  // Debounce the project ticket search so we don't hammer the API on every keystroke.
  $effect(() => {
    const term = query.trim();
    if (selected) return;
    if (term.length < 2) {
      results = [];
      searching = false;
      return;
    }

    let cancelled = false;
    searching = true;

    const timer = setTimeout(async () => {
      try {
        const res = await client.api.projects[":key"].tickets.$get({
          param: { key: projectKey },
          query: { titleSearch: term, perPage: "8", includeClosed: "true" },
        });
        if (cancelled) return;
        if (res.ok) {
          const body = await res.json();
          results = body.tickets.filter((t) => t.number !== ticketNumber).map((t) => ({ id: t.id, number: t.number, title: t.title }));
        } else {
          results = [];
        }
      } finally {
        if (!cancelled) searching = false;
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });

  // Group links by their rendered label so the sidebar reads like:
  //   blocks
  //     KEY-12 ...
  //   is blocked by
  //     KEY-7 ...
  type Group = { label: string; entries: TicketLink[] };
  const grouped = $derived.by((): Group[] => {
    const buckets = new Map<string, TicketLink[]>();
    for (const link of links) {
      const label = linkLabel(link.linkType, link.direction);
      const list = buckets.get(label) ?? [];
      list.push(link);
      buckets.set(label, list);
    }
    return [...buckets.entries()].map(([label, entries]) => ({ label, entries }));
  });

  function startAdding() {
    adding = true;
    error = null;
    query = "";
    selected = null;
    results = [];
    optionKey = LINK_OPTIONS[0].key;
  }

  function cancelAdding() {
    adding = false;
    query = "";
    selected = null;
    results = [];
    error = null;
  }

  function pickResult(result: SearchResult) {
    selected = result;
    query = "";
    results = [];
  }

  function clearSelection() {
    selected = null;
    query = "";
  }

  async function addLink() {
    if (!selected || saving) return;

    saving = true;
    error = null;
    try {
      const res = await client.api.projects[":key"].tickets[":num"].links.$post({
        param: { key: projectKey, num: String(ticketNumber) },
        json: { targetRef: `${projectKey}-${selected.number}`, linkType: selectedOption.linkType, direction: selectedOption.direction },
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        error = data.message ?? "Failed to add link.";
        return;
      }

      cancelAdding();
      await onmutated();
    } finally {
      saving = false;
    }
  }

  async function removeLink(link: TicketLink) {
    if (deletingID) return;
    deletingID = link.id;
    try {
      const res = await client.api.projects[":key"].tickets[":num"].links[":id"].$delete({
        param: { key: projectKey, num: String(ticketNumber), id: link.id },
      });
      if (!res.ok) return;
      await onmutated();
    } finally {
      deletingID = null;
    }
  }
</script>

<section class="links-card" aria-label="Links">
  <header class="header">
    <h2>Links</h2>
    <button type="button" class="add-trigger" onclick={startAdding} aria-label="Add link" disabled={adding}>
      <Plus size={14} strokeWidth={3} />
    </button>
  </header>

  {#if adding}
    <form
      class="add-form"
      onsubmit={(event) => {
        event.preventDefault();
        void addLink();
      }}
    >
      <select bind:value={optionKey} disabled={saving} class="link-type-select" aria-label="Link type">
        {#each LINK_OPTIONS as option (option.key)}
          <option value={option.key}>{option.label}</option>
        {/each}
      </select>

      {#if selected}
        <div class="selected-pill">
          <span class="selected-key">{projectKey}-{selected.number}</span>
          <span class="selected-title">{selected.title}</span>
          <button type="button" class="clear" onclick={clearSelection} aria-label="Clear selected ticket" disabled={saving}>
            <X size={12} strokeWidth={2} />
          </button>
        </div>
      {:else}
        <div class="search-wrap">
          <input type="text" bind:value={query} placeholder="Search tickets..." class="target-input" disabled={saving} aria-label="Search tickets" autocomplete="off" />
          {#if query.trim().length >= 2}
            <ul class="results" role="listbox">
              {#if searching && results.length === 0}
                <li class="result muted">Searching...</li>
              {:else if results.length === 0}
                <li class="result muted">No matches.</li>
              {:else}
                {#each results as result (result.id)}
                  <li>
                    <button type="button" class="result" onclick={() => pickResult(result)}>
                      <span class="result-key">{projectKey}-{result.number}</span>
                      <span class="result-title">{result.title}</span>
                    </button>
                  </li>
                {/each}
              {/if}
            </ul>
          {/if}
        </div>
      {/if}

      {#if error}
        <p class="error" role="alert">{error}</p>
      {/if}
      <div class="form-actions">
        <Button type="button" variant="secondary" size="sm" onclick={cancelAdding} disabled={saving}>Cancel</Button>
        <Button type="submit" size="sm" disabled={saving || !selected}>{saving ? "Adding..." : "Add"}</Button>
      </div>
    </form>
  {/if}

  {#if grouped.length === 0 && !adding}
    <p class="empty">No links.</p>
  {:else}
    <div class="groups">
      {#each grouped as group (group.label)}
        <div class="group">
          <h3 class="group-label">{group.label}</h3>
          <ul class="group-list">
            {#each group.entries as link (link.id)}
              <li class="link-row">
                <a class="link-target" href={resolve("/projects/[key]/tickets/[num]", { key: link.ticket.projectKey, num: String(link.ticket.number) })}>
                  <span class="link-key">{link.ticket.projectKey}-{link.ticket.number}</span>
                  <span class="link-title">{link.ticket.title}</span>
                </a>
                <button
                  type="button"
                  class="remove"
                  onclick={() => void removeLink(link)}
                  disabled={deletingID === link.id}
                  aria-label={`Remove ${linkLabel(link.linkType, link.direction)} ${link.ticket.projectKey}-${link.ticket.number}`}
                >
                  <X size={12} strokeWidth={2} />
                </button>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .links-card {
    border: var(--border);
    border-radius: var(--border-radius-outer);
    background: var(--colour-bg-lighter);
    box-shadow: var(--box-shadow);
    padding: 0.85rem;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.7rem;

    & h2 {
      color: var(--colour-text);
      font-size: 0.8rem;
      font-weight: 800;
    }
  }

  .add-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.4rem;
    height: 1.4rem;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg);
    color: var(--colour-muted);
    cursor: pointer;

    &:hover:not(:disabled) {
      color: var(--accent-base);
      border-color: var(--accent-tint-600);
      background: var(--accent-tint-900);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .empty {
    margin: 0;
    color: var(--colour-muted);
    font-size: 0.8rem;
    font-style: italic;
  }

  .groups {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .group-label {
    color: var(--colour-muted);
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.3rem;
  }

  .group-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .link-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
    padding: 0.3rem 0.4rem;
    border-radius: var(--border-radius-inner);

    &:hover {
      background: var(--colour-bg);
    }
  }

  .link-target {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    flex: 1;
    text-decoration: none;
    color: inherit;

    &:hover .link-title {
      text-decoration: underline;
    }
  }

  .link-key {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--accent-base);
    white-space: nowrap;
  }

  .link-title {
    font-size: 0.8rem;
    color: var(--colour-text);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.2rem;
    height: 1.2rem;
    border: 0;
    background: transparent;
    color: var(--colour-muted);
    border-radius: var(--border-radius-inner);
    cursor: pointer;
    opacity: 0;
    transition: opacity 120ms ease;

    &:hover {
      color: var(--colour-error);
      background: var(--colour-bg-lighter);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  .link-row:hover .remove,
  .remove:focus-visible {
    opacity: 1;
  }

  .add-form {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.5rem;
    margin-bottom: 0.7rem;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg);
  }

  .link-type-select,
  .target-input {
    width: 100%;
    padding: 0.35rem 0.45rem;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg-lighter);
    color: var(--colour-text);
    font: inherit;
    font-size: 0.8rem;
  }

  .target-input::placeholder {
    color: var(--colour-muted);
  }

  .search-wrap {
    position: relative;
  }

  .results {
    position: absolute;
    top: calc(100% + 0.25rem);
    left: 0;
    right: 0;
    z-index: 10;
    list-style: none;
    margin: 0;
    padding: 0.25rem;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg-lighter);
    box-shadow: var(--box-shadow);
    max-height: 14rem;
    overflow-y: auto;
  }

  .result {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.35rem 0.45rem;
    border: 0;
    background: transparent;
    color: var(--colour-text);
    font: inherit;
    font-size: 0.8rem;
    text-align: left;
    cursor: pointer;
    border-radius: var(--border-radius-inner);

    &:hover,
    &:focus-visible {
      background: var(--colour-bg);
      outline: none;
    }

    &.muted {
      color: var(--colour-muted);
      cursor: default;
      font-style: italic;
    }
  }

  .result-key {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--accent-base);
    flex: 0 0 auto;
  }

  .result-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .selected-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.25rem 0.4rem 0.25rem 0.55rem;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg-lighter);
    font-size: 0.8rem;
  }

  .selected-key {
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--accent-base);
  }

  .selected-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--colour-text);
  }

  .clear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1rem;
    height: 1rem;
    margin-left: auto;
    border: 0;
    background: transparent;
    color: var(--colour-muted);
    border-radius: 50%;
    cursor: pointer;

    &:hover {
      color: var(--colour-text);
      background: var(--colour-bg);
    }
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.4rem;
  }

  .error {
    margin: 0;
    color: var(--colour-error);
    font-size: 0.75rem;
  }
</style>
