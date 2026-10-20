<script lang="ts">
  import type { Status } from "@issues/api";
  import { STATUS_CATEGORIES } from "@issues/shared";
  import StatusChip from "$lib/components/tickets/StatusChip.svelte";

  let { statuses }: { statuses: Status[] } = $props();

  const orderedStatuses = $derived(
    [...statuses].sort((first, second) => {
      const categoryDifference = STATUS_CATEGORIES.indexOf(first.category) - STATUS_CATEGORIES.indexOf(second.category);
      return categoryDifference !== 0 ? categoryDifference : first.position - second.position;
    })
  );
</script>

<div class="read-only">
  <p class="note">Only the project owner can change statuses.</p>
  <ul class="chips" aria-label="Statuses">
    {#each orderedStatuses as status (status.id)}
      <li><StatusChip name={status.name} category={status.category} /></li>
    {/each}
  </ul>
</div>

<style>
  .read-only {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .note {
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
