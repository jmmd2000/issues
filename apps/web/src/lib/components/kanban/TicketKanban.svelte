<script lang="ts">
  import type { ProjectMember, Status, Ticket } from "@issues/api";
  import type { DndEvent } from "svelte-dnd-action";
  import { onDestroy } from "svelte";
  import { SvelteMap } from "svelte/reactivity";
  import { client } from "$lib/api/client";
  import TicketKanbanColumn from "./TicketKanbanColumn.svelte";

  let {
    projectKey,
    statuses,
    tickets,
    members,
  }: {
    projectKey: string;
    statuses: Status[];
    tickets: Ticket[];
    members: ProjectMember[];
  } = $props();

  function comparePosition(a: string, b: string) {
    if (a === b) return 0;
    return a < b ? -1 : 1;
  }

  function sortByPosition(ts: readonly Ticket[]) {
    return [...ts].sort((a, b) => comparePosition(a.position, b.position));
  }

  let localTickets: Ticket[] = $derived(sortByPosition(tickets));

  let ticketsByStatus = $derived.by(() => {
    const map = new SvelteMap<string, Ticket[]>();
    for (const s of statuses) map.set(s.id, []);
    for (const t of localTickets) {
      const col = map.get(t.statusID);
      if (col) col.push(t);
    }
    return map;
  });

  function handleConsider(statusID: string, items: Ticket[]) {
    const incomingIDs = new Set(items.map((i) => i.id));
    const untouched = localTickets.filter((t) => t.statusID !== statusID && !incomingIDs.has(t.id));
    const rewritten = items.map((t) => (t.statusID === statusID ? t : { ...t, statusID }));
    localTickets = [...untouched, ...rewritten];
  }

  const pendingMoves = new SvelteMap<string, AbortController>();

  onDestroy(() => {
    for (const controller of pendingMoves.values()) controller.abort();
    pendingMoves.clear();
  });

  async function handleFinalize(statusID: string, items: Ticket[], info: DndEvent<Ticket>["info"]) {
    handleConsider(statusID, items);

    const movedIndex = items.findIndex((t) => t.id === info.id);
    if (movedIndex === -1) return;
    const moved = items[movedIndex];
    const beforeID = items[movedIndex - 1]?.id ?? null;
    const afterID = items[movedIndex + 1]?.id ?? null;

    pendingMoves.get(moved.id)?.abort();
    const controller = new AbortController();
    pendingMoves.set(moved.id, controller);

    try {
      const res = await client.api.projects[":key"].tickets[":num"].move.$patch(
        {
          param: { key: projectKey, num: String(moved.number) },
          json: { statusID, beforeID, afterID },
        },
        { init: { signal: controller.signal } }
      );
      if (pendingMoves.get(moved.id) !== controller) return;
      pendingMoves.delete(moved.id);
      if (!res.ok) throw new Error("move failed");
      const data = (await res.json()) as { ticket: Ticket };
      localTickets = localTickets.map((t) => (t.id === data.ticket.id ? data.ticket : t));
    } catch {
      if (controller.signal.aborted) return;
      pendingMoves.delete(moved.id);
      localTickets = sortByPosition(tickets);
    }
  }
</script>

<div class="kanban">
  <div class="columns">
    {#each statuses as status (status.id)}
      <TicketKanbanColumn {projectKey} {status} tickets={ticketsByStatus.get(status.id) ?? []} {members} onConsider={handleConsider} onFinalize={handleFinalize} />
    {/each}
    {#if statuses.length === 0}
      <div class="no-columns">No columns selected. Click "Columns" to choose.</div>
    {/if}
  </div>
</div>

<style>
  .kanban {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .columns {
    display: flex;
    gap: 0.75em;
    overflow-x: auto;
    padding-bottom: 0.5em;
    align-items: flex-start;
  }

  .no-columns {
    font-size: 0.85em;
    color: var(--colour-muted);
    padding: 2em;
    border: 1px dashed var(--colour-border);
    border-radius: var(--border-radius-outer);
    width: 100%;
    text-align: center;
  }
</style>
