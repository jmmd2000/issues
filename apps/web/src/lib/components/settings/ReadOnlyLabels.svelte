<script lang="ts">
  import type { Label } from "@issues/api";
  import LabelChip from "$lib/components/tickets/LabelChip.svelte";

  let { labels }: { labels: Label[] } = $props();
</script>

<div class="read-only">
  <p class="note">Only the project owner can change labels.</p>
  {#if labels.length === 0}
    <p class="empty">This project has no labels.</p>
  {:else}
    <ul class="chips" aria-label="Labels">
      {#each labels as label (label.id)}
        <li><LabelChip name={label.name} colour={label.colour} /></li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .read-only {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .note,
  .empty {
    margin: 0;
    color: var(--colour-text-secondary);
    font-size: 0.9em;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
</style>
