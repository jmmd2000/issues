<script lang="ts">
  import type { Snippet } from "svelte";
  import { ChevronDown, ChevronRight } from "@lucide/svelte";

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
  <button type="button" class="group-head" onclick={onToggle} aria-expanded={open}>
    {#if open}<ChevronDown size={11} />{:else}<ChevronRight size={11} />{/if}
    <h3>{title}</h3>
    {#if count > 0}<span class="active-badge">{count}</span>{/if}
  </button>
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

  .group-head {
    display: flex;
    align-items: center;
    gap: 0.35em;
    width: 100%;
    background: transparent;
    border: none;
    padding: 0.3em 0.2em;
    cursor: pointer;
    border-radius: var(--border-radius-inner);
    text-align: left;
    color: var(--colour-text-secondary);

    &:hover {
      background: var(--colour-bg-lighter);
      color: var(--colour-text);
    }

    h3 {
      font-size: 0.65em;
      font-weight: 600;
      color: var(--colour-muted);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      flex: 1;
    }
  }

  .active-badge {
    font-family: var(--font-mono);
    font-size: 0.7em;
    font-weight: 700;
    padding: 0 0.4em;
    border-radius: 999px;
    background: color-mix(in oklch, var(--accent-base) 15%, white 85%);
    color: var(--accent-shade-200);
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
