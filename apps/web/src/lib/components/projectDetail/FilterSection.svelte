<script lang="ts">
  import type { Snippet } from "svelte";
  import SectionToggle from "./SectionToggle.svelte";

  interface FilterSectionProps {
    title: string;
    open: boolean;
    count: number;
    onToggle: () => void;
    children: Snippet;
  }

  let { title, open, count, onToggle, children }: FilterSectionProps = $props();
</script>

<section class="group">
  <SectionToggle {title} {open} {onToggle} {count} />
  {#if open}
    <ul>
      {@render children()}
    </ul>
  {/if}
</section>

<style>
  .group {
    display: flex;
    flex-direction: column;
    gap: 0.25em;
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15em;
  }
</style>
