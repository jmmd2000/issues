<script lang="ts">
  import { Check, ChevronDown, LoaderCircle, Tag } from "@lucide/svelte";
  import { untrack } from "svelte";
  import type { Label } from "@issues/api";
  import Popover from "$lib/components/ui/Popover.svelte";

  let {
    labels,
    value = $bindable<string[]>([]),
    oncommit,
    disabled = false,
    loading = false,
    size = "md",
    ariaLabel = "Labels",
  }: {
    labels: Label[];
    value?: string[];
    oncommit?: (next: string[], previous: string[]) => void;
    disabled?: boolean;
    loading?: boolean;
    size?: "sm" | "md";
    ariaLabel?: string;
  } = $props();

  let open = $state(false);
  let query = $state("");
  let searchInput: HTMLInputElement | null = $state(null);
  let snapshot: string[] = [];
  let prevOpen = false;

  const labelByID = $derived(new Map(labels.map((label) => [label.id, label])));
  const selectedSet = $derived(new Set(value));
  const selectedLabels = $derived(value.map((id) => labelByID.get(id)).filter((label): label is Label => Boolean(label)));

  const filtered = $derived.by(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return labels;
    return labels.filter((label) => label.name.toLowerCase().includes(needle));
  });

  $effect(() => {
    const isOpen = open;

    if (isOpen && !prevOpen) {
      snapshot = untrack(() => [...value]);
      queueMicrotask(() => searchInput?.focus());
    } else if (!isOpen && prevOpen) {
      query = "";
      const current = untrack(() => value);
      if (!arraysEqual(snapshot, current)) {
        const previous = snapshot;
        snapshot = [...current];
        oncommit?.(current, previous);
      }
    }

    prevOpen = isOpen;
  });

  function arraysEqual(a: string[], b: string[]) {
    if (a.length !== b.length) return false;
    const setB = new Set(b);
    return a.every((id) => setB.has(id));
  }

  function toggle(labelID: string) {
    if (disabled) return;
    if (selectedSet.has(labelID)) {
      value = value.filter((id) => id !== labelID);
    } else {
      value = [...value, labelID];
    }
  }
</script>

<Popover bind:open {disabled} menuLabel="Ticket labels">
  {#snippet trigger({ toggle: toggleOpen, open })}
    <button type="button" class="trigger" data-size={size} data-empty={selectedLabels.length === 0} onclick={toggleOpen} aria-expanded={open} aria-haspopup="listbox" aria-label={ariaLabel} {disabled}>
      {#if loading}
        <LoaderCircle size={14} strokeWidth={2} class="spinner" aria-label="Saving labels" />
      {:else if selectedLabels.length === 0}
        <span class="empty-state">
          <Tag size={13} strokeWidth={2} />
          <span>Add labels</span>
        </span>
      {:else}
        <span class="chip-row">
          {#each selectedLabels as label (label.id)}
            <span class="ticket-label" style:--label-colour={label.colour}>{label.name}</span>
          {/each}
        </span>
      {/if}
      <ChevronDown size={13} strokeWidth={2} class="chevron" />
    </button>
  {/snippet}

  {#snippet menu()}
    <input bind:this={searchInput} class="search" type="text" placeholder="Search labels..." bind:value={query} {disabled} />

    {#if labels.length === 0}
      <p class="empty">This project has no labels yet.</p>
    {:else}
      <div class="option-list">
        {#each filtered as label (label.id)}
          {@const selected = selectedSet.has(label.id)}
          <button type="button" class="option" role="option" aria-selected={selected} onclick={() => toggle(label.id)} {disabled}>
            <span class="check">
              {#if selected}<Check size={12} strokeWidth={3} />{/if}
            </span>
            <span class="swatch" style:--swatch-colour={label.colour}></span>
            <span class="option-name">{label.name}</span>
          </button>
        {:else}
          <p class="empty">No labels match.</p>
        {/each}
      </div>
    {/if}
  {/snippet}
</Popover>

<style>
  .trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    border-radius: var(--border-radius-inner);
    color: var(--colour-text);
    font: inherit;
    cursor: pointer;
    text-align: left;
  }

  .trigger[data-size="md"] {
    min-height: 2.4em;
    padding: 0.45em 0.7em;
    border: var(--border);
    background: var(--colour-bg);
    font-size: 0.85em;
  }

  .trigger[data-size="md"]:hover,
  .trigger[data-size="md"]:focus-visible,
  .trigger[data-size="md"][aria-expanded="true"] {
    background: var(--colour-bg-hover);
  }

  .trigger[data-size="sm"] {
    min-height: 1.65rem;
    margin-left: -0.35rem;
    padding: 0.2rem 0.35rem;
    border: var(--border);
    background: var(--colour-bg);
    font-size: 0.8rem;
    font-weight: 600;
  }

  .trigger[data-size="sm"]:hover,
  .trigger[data-size="sm"]:focus-visible,
  .trigger[data-size="sm"][aria-expanded="true"] {
    background: var(--colour-bg-hover);
  }

  .trigger:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }

  .trigger[data-empty="true"] .empty-state {
    color: var(--colour-muted);
  }

  .empty-state {
    display: inline-flex;
    align-items: center;
    gap: 0.35em;
    font-weight: 500;
  }

  .chip-row {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    flex: 1;
    min-width: 0;
  }

  .ticket-label {
    --label-colour: var(--colour-muted);

    max-width: 100%;
    padding: 0.2rem 0.4rem;
    border: 1px solid color-mix(in oklch, var(--label-colour) 35%, white 65%);
    border-radius: var(--border-radius-inner);
    background: color-mix(in oklch, var(--label-colour) 15%, white 85%);
    color: color-mix(in oklch, var(--label-colour) 75%, black 25%);
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1.1;
    white-space: nowrap;
  }

  .trigger :global(.chevron) {
    flex: 0 0 auto;
    margin-left: auto;
    color: var(--colour-text-secondary);
  }

  .trigger :global(.spinner) {
    animation: spin 720ms linear infinite;
    color: var(--accent-base);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .search {
    width: 100%;
    padding: 0.4em 0.55em;
    margin-bottom: 0.2em;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg);
    color: var(--colour-text);
    font: inherit;
    font-size: 0.8em;
    outline: none;
  }

  .search::placeholder {
    color: var(--colour-muted);
  }

  .search:disabled,
  .option:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }

  .option-list {
    display: flex;
    flex-direction: column;
    gap: 0.1em;
    max-height: 16em;
    overflow-y: auto;
  }

  .option {
    display: flex;
    align-items: center;
    gap: 0.55em;
    padding: 0.45em 0.5em;
    border: none;
    border-radius: var(--border-radius-inner);
    background: none;
    color: var(--colour-text);
    font: inherit;
    font-size: 0.8em;
    text-align: left;
    cursor: pointer;
  }

  .option:hover {
    background: var(--colour-bg-hover);
  }

  .option[aria-selected="true"] {
    color: var(--accent-base);
    font-weight: 600;
  }

  .check {
    width: 0.9em;
    height: 0.9em;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-base);
    flex-shrink: 0;
  }

  .swatch {
    --swatch-colour: var(--colour-muted);

    flex: 0 0 auto;
    width: 0.7em;
    height: 0.7em;
    border-radius: 999px;
    background: var(--swatch-colour);
    border: 1px solid color-mix(in oklch, var(--swatch-colour) 50%, black 50%);
  }

  .option-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .empty {
    margin: 0;
    padding: 0.45em 0.5em;
    color: var(--colour-muted);
    font-size: 0.8em;
  }
</style>
