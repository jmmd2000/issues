<script lang="ts">
  import type { Ticket } from "@issues/api";
  import PriorityChip from "../tickets/PriorityChip.svelte";

  let { projectKey, ticket }: { projectKey: string; ticket: Ticket } = $props();
</script>

<article class="card" style:border-left-color={`var(--colour-priority-${ticket.priority})`} aria-label={ticket.title}>
  <div class="top">
    <span class="number">{projectKey}-{ticket.number}</span>
    <PriorityChip priority={ticket.priority} />
  </div>
  <h4 class="title">{ticket.title}</h4>
</article>

<style>
  .card {
    background: var(--colour-bg-lighter);
    border: var(--border);
    border-radius: var(--border-radius-inner);
    border-left: 4px solid;
    padding: 0.6em 0.7em;
    box-shadow: var(--box-shadow);
    cursor: grab;
    user-select: none;

    &:active {
      cursor: grabbing;
    }
  }

  .top {
    display: flex;
    align-items: center;
    gap: 0.4em;
    margin-bottom: 0.35em;
  }

  .number {
    font-family: var(--font-mono);
    font-size: 0.8em;
    color: var(--colour-text-secondary);
  }

  .title {
    font-size: 0.7em;
    font-weight: 500;
    line-height: 1.35;
    margin: 0;
    color: var(--colour-text);
    letter-spacing: -0.01em;
    overflow: hidden;
  }
</style>
