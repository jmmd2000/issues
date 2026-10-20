<script lang="ts">
  import type { Snippet } from "svelte";

  let { title, help, stacked = false, children }: { title?: string; help?: string; stacked?: boolean; children: Snippet } = $props();
</script>

<div class="row" data-stacked={stacked}>
  {#if title || help}
    <div class="copy">
      {#if title}<div class="title">{title}</div>{/if}
      {#if help}<div class="help">{help}</div>{/if}
    </div>
  {/if}
  <div class="control">
    {@render children()}
  </div>
</div>

<style>
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.75rem 1.5rem;
    align-items: center;
    padding: 0.875rem 1rem;
    border-top: var(--border);

    &:first-child {
      border-top: 0;
    }

    &[data-stacked="true"] {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .title {
    font-size: 0.9375rem;
    font-weight: 500;
  }

  .help {
    max-width: 52ch;
    color: var(--colour-text-secondary);
    font-size: 0.8125rem;
  }

  .control {
    min-width: 0;
  }

  @media (max-width: 40rem) {
    .row {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
