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

<span class="status-chip" style:--status-colour={colours[category]}>{name}</span>

<style>
  .status-chip {
    --status-colour: var(--colour-status-backlog);

    display: inline-flex;
    align-items: center;
    min-height: 1.4rem;
    padding: 0.2rem 0.45rem;
    border: 1px solid color-mix(in oklch, var(--status-colour) 35%, white 65%);
    border-radius: var(--border-radius-inner);
    background: color-mix(in oklch, var(--status-colour) 10%, white 90%);
    color: color-mix(in oklch, var(--status-colour) 80%, black 20%);
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
  }
</style>
