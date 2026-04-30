<script lang="ts">
  import { Check } from "@lucide/svelte";
  import type { Label } from "@issues/api";

  let {
    labels,
    value = $bindable<string[]>([]),
  }: {
    labels: Label[];
    value?: string[];
  } = $props();

  const selectedSet = $derived(new Set(value));

  function toggle(labelID: string) {
    if (selectedSet.has(labelID)) {
      value = value.filter((id) => id !== labelID);
    } else {
      value = [...value, labelID];
    }
  }
</script>

{#if labels.length === 0}
  <p class="picker-empty">This project has no labels yet.</p>
{:else}
  <div class="label-chips" role="group" aria-label="Ticket labels">
    {#each labels as label (label.id)}
      {@const selected = selectedSet.has(label.id)}
      <button type="button" class="label-chip" style={`--chip-colour: ${label.colour};`} data-selected={selected} aria-pressed={selected} onclick={() => toggle(label.id)}>
        <span class="chip-swatch"></span>
        <span>{label.name}</span>
        {#if selected}
          <Check size={12} strokeWidth={3} />
        {/if}
      </button>
    {/each}
  </div>
{/if}

<style>
  .label-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4em;
  }

  .label-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    padding: 0.35em 0.65em;
    border: var(--border);
    border-radius: 999px;
    background: var(--colour-bg-lighter);
    color: var(--colour-text-secondary);
    font-size: 0.8em;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition:
      background 0.12s,
      color 0.12s,
      border-color 0.12s;
  }

  .label-chip:hover {
    background: var(--colour-bg-hover);
  }

  .label-chip[data-selected="true"] {
    background: var(--accent-tint-900);
    color: var(--accent-base);
    border-color: var(--accent-tint-600);
  }

  .chip-swatch {
    display: inline-block;
    width: 0.7em;
    height: 0.7em;
    border-radius: 999px;
    background: var(--chip-colour, var(--colour-muted));
    border: 1px solid rgba(0, 0, 0, 0.1);
  }

  .picker-empty {
    margin: 0;
    color: var(--colour-muted);
    font-size: 0.8em;
  }
</style>
