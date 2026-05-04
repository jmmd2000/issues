<script module lang="ts">
  import type { Ticket } from "@issues/api";
  import type { TicketListColumnID, TicketListSortDirection } from "./TicketList.svelte";

  export type TicketViewMode = "kanban" | "list";
  export type TicketData =
    | { kind: "kanban"; tickets: Ticket[] }
    | { kind: "list"; tickets: Ticket[]; page: number; perPage: number; hasNextPage: boolean; sortColumn: TicketListColumnID; sortDirection: TicketListSortDirection };
</script>

<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import type { ProjectDetail, ProjectMember, Status } from "@issues/api";
  import { Columns3, List } from "@lucide/svelte";
  import { SvelteSet } from "svelte/reactivity";
  import ColumnPicker from "$lib/components/kanban/ColumnPicker.svelte";
  import TicketKanban from "$lib/components/kanban/TicketKanban.svelte";
  import TicketList, { LIST_COLUMNS } from "./TicketList.svelte";

  type SearchUpdateOptions = {
    scrollToList?: boolean;
  };

  let {
    project,
    statuses,
    members,
    view,
    ticketData,
  }: {
    project: ProjectDetail;
    statuses: Status[];
    members: ProjectMember[];
    view: TicketViewMode;
    ticketData: TicketData;
  } = $props();

  const STATUS_CATEGORY_ORDER: Record<Status["category"], number> = {
    backlog: 0,
    active: 1,
    done: 2,
    cancelled: 3,
  };
  const kanbanStorageKey = $derived(`kanban-columns-${project.id}`);
  const listStorageKey = $derived(`ticket-list-columns-${project.id}`);
  const orderedStatuses = $derived([...statuses].sort((a, b) => STATUS_CATEGORY_ORDER[a.category] - STATUS_CATEGORY_ORDER[b.category] || a.position - b.position));
  const kanbanColumnItems = $derived(orderedStatuses.map((status) => ({ id: status.id, label: status.name })));
  const listColumnItems = LIST_COLUMNS.map((column) => ({ id: column.id, label: column.label }));

  function readVisibleKanbanColumnIDs(): SvelteSet<string> {
    const allIDs = new Set(statuses.map((status) => status.id));
    if (typeof localStorage === "undefined") return new SvelteSet(allIDs);

    const raw = localStorage.getItem(kanbanStorageKey);
    if (!raw) return new SvelteSet(allIDs);

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new SvelteSet(allIDs);
      return new SvelteSet(parsed.filter((id): id is string => typeof id === "string" && allIDs.has(id)));
    } catch {
      return new SvelteSet(allIDs);
    }
  }

  function readVisibleListColumnIDs(): SvelteSet<TicketListColumnID> {
    const allIDs = new Set<TicketListColumnID>(LIST_COLUMNS.map((column) => column.id));
    if (typeof localStorage === "undefined") return new SvelteSet(allIDs);

    const raw = localStorage.getItem(listStorageKey);
    if (!raw) return new SvelteSet(allIDs);

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new SvelteSet(allIDs);
      const visible = parsed.filter((id): id is TicketListColumnID => typeof id === "string" && allIDs.has(id as TicketListColumnID));
      return new SvelteSet(visible.length > 0 ? visible : [...allIDs]);
    } catch {
      return new SvelteSet(allIDs);
    }
  }

  let visibleKanbanColumnIDs = $state<SvelteSet<string>>(readVisibleKanbanColumnIDs());
  let visibleListColumnIDs = $state<SvelteSet<TicketListColumnID>>(readVisibleListColumnIDs());
  let listScrollTarget = $state<HTMLDivElement | null>(null);
  const visibleStatuses = $derived(orderedStatuses.filter((status) => visibleKanbanColumnIDs.has(status.id)));

  function persistVisibleKanbanColumnIDs(next: SvelteSet<string>) {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(kanbanStorageKey, JSON.stringify([...next]));
  }

  function persistVisibleListColumnIDs(next: SvelteSet<TicketListColumnID>) {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(listStorageKey, JSON.stringify([...next]));
  }

  function toggleColumn(id: string) {
    const next = new SvelteSet(visibleKanbanColumnIDs);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    visibleKanbanColumnIDs = next;
    persistVisibleKanbanColumnIDs(next);
  }

  function toggleListColumn(id: string) {
    const columnID = id as TicketListColumnID;
    const next = new SvelteSet(visibleListColumnIDs);
    if (next.has(columnID)) {
      if (next.size === 1) return;
      next.delete(columnID);
    } else {
      next.add(columnID);
    }
    visibleListColumnIDs = next;
    persistVisibleListColumnIDs(next);
  }

  function scrollToListStart() {
    listScrollTarget?.scrollIntoView({ block: "start" });
  }

  async function updateSearchParams(params: Record<string, string | null>, options: SearchUpdateOptions = {}) {
    const next = new URL(page.url);
    for (const [key, value] of Object.entries(params)) {
      if (value === null) next.searchParams.delete(key);
      else next.searchParams.set(key, value);
    }
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    await goto(`${next.pathname}${next.search}`, { keepFocus: true, noScroll: true });
    if (options.scrollToList) requestAnimationFrame(scrollToListStart);
  }

  function setView(nextView: TicketViewMode) {
    void updateSearchParams({
      view: nextView === "kanban" ? null : nextView,
      page: null,
      perPage: nextView === "kanban" ? null : page.url.searchParams.get("perPage"),
      sortBy: nextView === "kanban" ? null : page.url.searchParams.get("sortBy"),
      sortDirection: nextView === "kanban" ? null : page.url.searchParams.get("sortDirection"),
    });
  }

  function setListPage(nextPage: number) {
    void updateSearchParams({ view: "list", page: String(nextPage) }, { scrollToList: true });
  }

  function setListSort(sortColumn: TicketListColumnID, sortDirection: TicketListSortDirection) {
    void updateSearchParams({
      view: "list",
      page: null,
      sortBy: sortColumn,
      sortDirection,
    });
  }
</script>

<section class="tickets-view">
  <div class="tickets-toolbar">
    <div class="view-controls" role="group" aria-label="Ticket view controls">
      <div class="view-toggle" role="group" aria-label="Ticket view">
        <button type="button" class:active={view === "kanban"} aria-pressed={view === "kanban"} onclick={() => setView("kanban")}>
          <Columns3 size={14} />
          Kanban
        </button>
        <button type="button" class:active={view === "list"} aria-pressed={view === "list"} onclick={() => setView("list")}>
          <List size={14} />
          List
        </button>
      </div>

      {#if view === "kanban"}
        <span class="control-divider" aria-hidden="true"></span>
        <ColumnPicker items={kanbanColumnItems} visible={visibleKanbanColumnIDs} onToggle={toggleColumn} />
      {:else}
        <span class="control-divider" aria-hidden="true"></span>
        <ColumnPicker items={listColumnItems} visible={visibleListColumnIDs} onToggle={toggleListColumn} />
      {/if}
    </div>
  </div>

  {#if ticketData.kind === "kanban"}
    <TicketKanban projectKey={project.key} statuses={visibleStatuses} tickets={ticketData.tickets} {members} />
  {:else}
    <div class="ticket-list-scroll-target" bind:this={listScrollTarget}>
      <TicketList
        projectKey={project.key}
        {statuses}
        {members}
        tickets={ticketData.tickets}
        visibleColumnIDs={visibleListColumnIDs}
        sortColumn={ticketData.sortColumn}
        sortDirection={ticketData.sortDirection}
        page={ticketData.page}
        hasNextPage={ticketData.hasNextPage}
        onSortChange={setListSort}
        onPageChange={setListPage}
      />
    </div>
  {/if}
</section>

<style>
  .tickets-view {
    display: grid;
    gap: 0.8em;
  }

  .tickets-toolbar {
    display: flex;
    justify-content: flex-end;
  }

  .ticket-list-scroll-target {
    scroll-margin-top: 1rem;
  }

  .view-controls {
    display: inline-flex;
    align-items: center;
    padding: 0.2em;
    gap: 0.15em;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg-lighter);
    box-shadow: var(--box-shadow);
  }

  .view-toggle {
    display: inline-flex;
    gap: 0.15em;
  }

  .view-toggle button {
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    padding: 0.4em 0.65em;
    border: none;
    border-radius: var(--border-radius-inner);
    background: transparent;
    color: var(--colour-text-secondary);
    font-family: inherit;
    font-size: 0.78em;
    font-weight: 600;
    cursor: pointer;
  }

  .view-toggle button:hover {
    color: var(--colour-text);
    background: var(--colour-bg-hover);
  }

  .view-toggle button.active {
    color: white;
    background: linear-gradient(180deg, #4a6ee8, var(--accent-base));
    box-shadow:
      rgba(30, 34, 41, 0.18) 0px 1px 2px,
      rgba(255, 255, 255, 0.14) 0px 1px 0px inset;
  }

  .control-divider {
    align-self: stretch;
    width: 1px;
    margin: 0.2em 0.35em;
    background: var(--colour-border);
  }
</style>
