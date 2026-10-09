<script module lang="ts">
  export interface ActiveFilter {
    id: string;
    group: string;
    label: string;
    remove: () => void;
  }
</script>

<script lang="ts">
  import { X } from "@lucide/svelte";

  interface ActiveFilterChipsProps {
    filters: ActiveFilter[];
    onClearAll: () => void;
  }

  let { filters, onClearAll }: ActiveFilterChipsProps = $props();
</script>

<div class="active-filters" role="group" aria-label="Active filters">
  {#each filters as filter (filter.id)}
    <span class="chip">
      <span class="group">{filter.group}</span>
      <span class="value">{filter.label}</span>
      <button type="button" class="remove" onclick={filter.remove} aria-label="Remove {filter.group.toLowerCase()} filter {filter.label}">
        <X size={11} strokeWidth={2.5} />
      </button>
    </span>
  {/each}

  {#if filters.length > 1}
    <button type="button" class="clear" onclick={onClearAll}>Clear all</button>
  {/if}
</div>

<style>
  .active-filters {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4em;
    padding: 0.5em 1.25em;
    border-bottom: var(--border);
    background: var(--colour-bg);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35em;
    padding: 0.15em 0.2em 0.15em 0.5em;
    font-size: 0.75rem;
    background: var(--colour-bg-lighter);
    border: var(--border);
    border-radius: var(--border-radius-inner);
    white-space: nowrap;
  }

  .group {
    color: var(--colour-muted);
    font-weight: 500;
  }

  .value {
    color: var(--colour-text);
    font-weight: 600;
  }

  .remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.1rem;
    height: 1.1rem;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--colour-muted);
    border-radius: var(--border-radius-inner);
    cursor: pointer;

    &:hover {
      color: var(--colour-text);
      background: var(--colour-bg-hover);
    }
  }

  .clear {
    border: none;
    background: transparent;
    color: var(--accent-base);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0.2em 0.4em;

    &:hover {
      text-decoration: underline;
    }
  }
</style>
