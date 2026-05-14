<script lang="ts">
  import { ChevronDown, ChevronRight } from "@lucide/svelte";

  interface SectionToggleProps {
    title: string;
    open: boolean;
    onToggle: () => void;
    /** Optional active-count badge. Undefined hides it, 0 hides it, positive shows a pill. */
    count?: number;
  }

  let { title, open, onToggle, count }: SectionToggleProps = $props();
</script>

<button type="button" class="toggle" onclick={onToggle} aria-expanded={open}>
  {#if open}<ChevronDown size={11} />{:else}<ChevronRight size={11} />{/if}
  <h3>{title}</h3>
  {#if count !== undefined && count > 0}<span class="badge">{count}</span>{/if}
</button>

<style>
  .toggle {
    display: flex;
    align-items: center;
    gap: 0.35em;
    width: 100%;
    background: transparent;
    border: none;
    padding: 0.3em 0.25em;
    cursor: pointer;
    border-radius: var(--border-radius-inner);
    text-align: left;
    color: var(--colour-text-secondary);

    &:hover {
      background: var(--colour-bg-lighter);
      color: var(--colour-text);
    }

    h3 {
      font-size: 0.7em;
      font-weight: 600;
      color: var(--colour-muted);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      flex: 1;
    }
  }

  .badge {
    font-family: var(--font-mono);
    font-size: 0.7em;
    font-weight: 700;
    padding: 0 0.4em;
    border-radius: 999px;
    background: var(--accent-tint-800);
    color: var(--accent-shade-200);
  }
</style>
