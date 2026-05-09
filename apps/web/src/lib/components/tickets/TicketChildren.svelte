<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { Plus } from "@lucide/svelte";
  import type { ProjectMember, Status, TicketChild } from "@issues/api";
  import { client } from "$lib/api/client";
  import TicketRow from "./TicketRow.svelte";
  import TicketSearchModal from "./TicketSearchModal.svelte";

  interface TicketChildrenProps {
    children: TicketChild[];
    projectKey: string;
    parentTicketID: string;
    parentTicketNumber: number;
    statuses: Status[];
    members: ProjectMember[];
    onmutated: () => void | Promise<void>;
  }

  let { children, projectKey, parentTicketID, parentTicketNumber, statuses, members, onmutated }: TicketChildrenProps = $props();

  const total = $derived(children.length);
  const done = $derived(children.filter((child) => child.status.category === "done" || child.status.category === "cancelled").length);
  const completionPercent = $derived(total === 0 ? 0 : Math.round((done / total) * 100));

  const excludeNumbers = $derived([parentTicketNumber, ...children.map((child) => child.number)]);

  let searchOpen = $state(false);
  let attaching = $state(false);

  async function attachExisting(ticket: { number: number }) {
    if (attaching) return;
    attaching = true;
    try {
      const res = await client.api.projects[":key"].tickets[":num"].$patch({
        param: { key: projectKey, num: String(ticket.number) },
        json: { parentTicketID },
      });
      if (!res.ok) return;
      searchOpen = false;
      await onmutated();
    } finally {
      attaching = false;
    }
  }

  function createNew() {
    goto(resolve("/projects/[key]/tickets/new", { key: projectKey }) + `?parent=${parentTicketNumber}`);
  }
</script>

<section class="children-card card" aria-label="Sub-tickets">
  <header class="children-header">
    <div class="heading">
      <h2>Sub-tickets</h2>
      <span class="count">{total}</span>
    </div>
    {#if total > 0}
      <span class="progress-label">{done} / {total} done</span>
    {/if}
  </header>

  {#if total > 0}
    <div class="progress-bar" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} aria-label="Sub-ticket completion">
      <div class="progress-fill" style:width="{completionPercent}%"></div>
    </div>

    <ul class="children-list">
      {#each children as child (child.id)}
        <li>
          <TicketRow
            ticket={{ id: child.id, number: child.number, title: child.title, projectKey }}
            status={child.status}
            priority={child.priority}
            assignee={child.assignee}
          />
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty">No sub-tickets yet.</p>
  {/if}

  <button type="button" class="add-trigger" onclick={() => (searchOpen = true)} disabled={attaching}>
    <Plus size={14} strokeWidth={2.5} />
    <span>Add sub-ticket</span>
  </button>
</section>

<TicketSearchModal
  open={searchOpen}
  title="Add sub-ticket"
  {projectKey}
  {statuses}
  {members}
  excludeTicketNumbers={excludeNumbers}
  onpicked={(ticket) => void attachExisting(ticket)}
  onclose={() => (searchOpen = false)}
  primaryAction={{ label: "+ Create new", run: createNew }}
/>

<style>
  .children-card {
    padding: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .children-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .heading {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;

    & h2 {
      color: var(--colour-text);
      font-size: 0.8rem;
      font-weight: 800;
    }
  }

  .count {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--colour-muted);
    background: var(--colour-bg);
    border: var(--border);
    border-radius: 999px;
    padding: 0.1rem 0.5rem;
    line-height: 1.2;
  }

  .progress-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--colour-muted);
  }

  .progress-bar {
    width: 100%;
    height: 0.7rem;
    border: var(--border);
    border-radius: 999px;
    background: linear-gradient(180deg, color-mix(in oklch, var(--colour-bg) 92%, black 8%), var(--colour-bg));
    box-shadow: inset 0 1px 2px rgb(from var(--colour-text) r g b / 0.1);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(180deg, color-mix(in oklch, var(--colour-status-done) 80%, white 20%), var(--colour-status-done));
    border-right: 1px solid color-mix(in oklch, var(--colour-status-done) 70%, black 30%);
    box-shadow:
      0 1px 2px rgb(from var(--colour-status-done) r g b / 0.35),
      inset 0 1px 0 rgb(255 255 255 / 0.4);
    transition: width 200ms ease;
  }

  .progress-fill[style*="width: 0%"] {
    border-right: 0;
    box-shadow: none;
  }

  .children-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .empty {
    margin: 0;
    color: var(--colour-muted);
    font-size: 0.8rem;
    font-style: italic;
  }

  .add-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.55rem;
    border: 1px dashed var(--colour-border);
    border-radius: var(--border-radius-inner);
    background: transparent;
    color: var(--colour-muted);
    font: inherit;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    width: fit-content;
    transition:
      color 120ms ease,
      border-color 120ms ease,
      background 120ms ease;

    &:hover:not(:disabled),
    &:focus-visible {
      color: var(--accent-base);
      border-color: var(--accent-tint-600);
      background: var(--accent-tint-900);
      outline: none;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
</style>
