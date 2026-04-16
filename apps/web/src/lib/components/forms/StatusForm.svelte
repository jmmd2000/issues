<script lang="ts">
  import { client } from "$lib/api/client";
  import type { Status } from "@issues/api";
  import FormMessage, { type FormMessage as FormMessageType } from "./FormMessage.svelte";
  import StatusColumn from "./StatusColumn.svelte";

  type Category = Status["category"];
  const CATEGORIES: Category[] = ["backlog", "active", "done", "cancelled"];
  const COLUMN_LABELS: Record<Category, string> = {
    backlog: "Backlog",
    active: "Active",
    done: "Done",
    cancelled: "Cancelled",
  };

  let { statuses, projectKey }: { statuses: Status[]; projectKey: string } = $props();

  // svelte-ignore state_referenced_locally
  let statusList = $state([...statuses]);
  let message = $state<FormMessageType | null>(null);

  // svelte-ignore state_referenced_locally
  let baseline: Status[] = [...statuses];
  let saveScheduled = false;

  const columns = $derived(Object.fromEntries(CATEGORIES.map((cat) => [cat, statusList.filter((s) => s.category === cat).sort((a, b) => a.position - b.position)])) as Record<Category, Status[]>);

  function handleStatusUpdate(next: Status) {
    statusList = statusList.map((s) => (s.id === next.id ? next : s));
    baseline = baseline.map((s) => (s.id === next.id ? next : s));
  }

  function handleStatusDelete(id: string) {
    statusList = statusList.filter((s) => s.id !== id);
    baseline = baseline.filter((s) => s.id !== id);
  }

  function handleStatusAdd(next: Status) {
    statusList = [...statusList, next];
    baseline = [...baseline, next];
  }

  // Re-normalises positions to (idx+1)*10 so the column's position-sorted view matches the drag order.
  // Without this, `columns` would re-sort the dragged item back to its old slot.
  function handleConsider(category: Category, items: Status[]) {
    const movedIDs = new Set(items.map((i) => i.id));
    const others = statusList.filter((s) => s.category !== category && !movedIDs.has(s.id));
    const reordered = items.map((s, idx) => ({ ...s, category, position: (idx + 1) * 10 }));
    statusList = [...others, ...reordered];
  }

  // svelte-dnd-action fires finalize on BOTH source and target zones for cross-zone drags.
  // queueMicrotask collapses both into a single API call, avoiding a race where the older
  // response overwrites the newer one and reverts the drop.
  function handleFinalize(category: Category, items: Status[]) {
    handleConsider(category, items);
    if (saveScheduled) return;
    saveScheduled = true;
    queueMicrotask(() => {
      saveScheduled = false;
      void persistOrder();
    });
  }

  async function persistOrder() {
    const snapshot = baseline;
    const order = statusList
      .filter((next) => {
        const prev = snapshot.find((s) => s.id === next.id);
        return !prev || prev.position !== next.position || prev.category !== next.category;
      })
      .map((s) => ({ id: s.id, position: s.position, category: s.category }));

    if (order.length === 0) return;

    message = null;
    try {
      const res = await client.api.projects[":key"].statuses.reorder.$patch({
        param: { key: projectKey },
        json: { order },
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        message = { type: "error", text: data.message ?? "Failed to save order." };
        statusList = snapshot;
        return;
      }
      const data = (await res.json()) as { statuses: Status[] };
      statusList = data.statuses;
      baseline = data.statuses;
    } catch {
      message = { type: "error", text: "Network error. Please try again." };
      statusList = snapshot;
    }
  }
</script>

<div class="settings-card">
  <div class="kanban">
    {#each CATEGORIES as category (category)}
      <StatusColumn
        {category}
        label={COLUMN_LABELS[category]}
        statuses={columns[category]}
        allStatuses={statusList}
        {projectKey}
        onConsider={(items) => handleConsider(category, items)}
        onFinalize={(items) => handleFinalize(category, items)}
        onUpdate={handleStatusUpdate}
        onDelete={handleStatusDelete}
        onAdd={handleStatusAdd}
      />
    {/each}
  </div>
  <FormMessage {message} />
</div>

<style>
  .kanban {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1em;
  }

  @media (max-width: 540px) {
    .kanban {
      grid-template-columns: 1fr;
    }
  }
</style>
