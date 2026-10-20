<script lang="ts">
  import type { Status } from "@issues/api";

  let {
    name,
    category,
  }: {
    name: string;
    category: Status["category"];
  } = $props();

  const colours: Record<Status["category"], string> = {
    backlog: "var(--colour-status-backlog)",
    active: "var(--colour-status-active)",
    done: "var(--colour-status-done)",
    cancelled: "var(--colour-status-cancelled)",
  };
</script>

<span class="status-chip tinted" style:--tint={colours[category]}>{name}</span>

<style>
  .status-chip {
    display: inline-flex;
    align-items: center;
    min-height: 1.4rem;
    padding: 0.2rem 0.45rem;
    border: 1px solid var(--tint-border);
    border-radius: var(--border-radius-inner);
    background: var(--tint-background);
    color: var(--tint-text);
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
  }
</style>
