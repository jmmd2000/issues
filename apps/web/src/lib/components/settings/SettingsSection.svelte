<script lang="ts">
  import type { Snippet } from "svelte";

  let { id, title, lede, children }: { id: string; title: string; lede?: string; children: Snippet } = $props();
</script>

<section {id} class="settings-section" aria-labelledby="{id}-title">
  <h2 id="{id}-title">{title}</h2>
  {#if lede}<p class="lede">{lede}</p>{/if}
  <div class="rows">
    {@render children()}
  </div>
</section>

<style>
  .settings-section {
    display: grid;
    gap: 0.75rem;
    scroll-margin-top: 1rem;

    & h2 {
      font-size: 1.0625rem;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
  }

  .lede {
    margin: -0.5rem 0 0;
    max-width: 60ch;
    color: var(--colour-text-secondary);
    font-size: 0.875rem;
  }

  .rows {
    border: var(--border);
    border-radius: var(--border-radius-outer);
    background: var(--colour-bg-lighter);
    box-shadow: var(--box-shadow);

    /* The existing forms draw their own card. Inside a panel they sit flat. */
    & :global(.settings-card) {
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
    }
  }
</style>
