<script lang="ts">
  import type { SearchHighlightPart } from "@issues/api";

  interface HighlightedTextProps {
    parts?: SearchHighlightPart[];
    fallback?: string;
  }

  let { parts = [], fallback = "" }: HighlightedTextProps = $props();

  const renderedParts = $derived(parts.length > 0 ? parts : fallback ? [{ text: fallback, highlighted: false }] : []);
</script>

{#each renderedParts as part, index (index)}
  {#if part.highlighted}
    <mark>{part.text}</mark>
  {:else}
    {part.text}
  {/if}
{/each}

<style>
  mark {
    padding: 0 0.15em;
    border-radius: var(--border-radius-inner);
    background: var(--accent-tint-800);
    color: var(--accent-shade-300);
    box-decoration-break: clone;
  }
</style>
