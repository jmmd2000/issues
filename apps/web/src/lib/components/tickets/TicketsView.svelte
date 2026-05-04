<script module lang="ts">
  import type { Ticket } from "@issues/api";
  import type { TicketListColumnID, TicketListSortDirection } from "./TicketList.svelte";

  export type TicketViewMode = "kanban" | "list";
  export type TicketData =
    | { kind: "kanban"; tickets: Ticket[] }
    | { kind: "list"; tickets: Ticket[]; page: number; perPage: number; hasNextPage: boolean; sortColumn: TicketListColumnID; sortDirection: TicketListSortDirection };

  export type TicketsFilters = {
    titleSearch: string | undefined;
    statusID: string[];
    priority: string[];
    assigneeID: string[];
    labelID: string[];
    showClosed: boolean;
  };

  export type BacklogState = {
    open: boolean;
    tickets: Ticket[];
  };
</script>

<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import type { Label, Priority, ProjectDetail, ProjectMember, Status } from "@issues/api";
  import { Columns3, Inbox, List } from "@lucide/svelte";
  import { SvelteSet } from "svelte/reactivity";
  import ColumnPicker from "$lib/components/kanban/ColumnPicker.svelte";
  import TicketKanban from "$lib/components/kanban/TicketKanban.svelte";
  import SearchInput from "$lib/components/ui/SearchInput.svelte";
  import Toggle from "$lib/components/ui/Toggle.svelte";
  import Tooltip from "$lib/components/ui/Tooltip.svelte";
  import AssigneePicker from "./AssigneePicker.svelte";
  import LabelsPicker from "./LabelsPicker.svelte";
  import PriorityPicker from "./PriorityPicker.svelte";
  import StatusPicker from "./StatusPicker.svelte";
  import TicketList, { LIST_COLUMNS } from "./TicketList.svelte";

  type SearchUpdateOptions = {
    scrollToList?: boolean;
  };

  let {
    project,
    statuses,
    labels,
    members,
    view,
    ticketData,
    backlog,
    filters,
  }: {
    project: ProjectDetail;
    statuses: Status[];
    labels: Label[];
    members: ProjectMember[];
    view: TicketViewMode;
    ticketData: TicketData;
    backlog: BacklogState;
    filters: TicketsFilters;
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
  const activeStatuses = $derived(orderedStatuses.filter((status) => status.category !== "backlog" && (filters.showClosed || status.category !== "cancelled")));
  const backlogStatuses = $derived(orderedStatuses.filter((status) => status.category === "backlog"));
  const primaryBacklogStatusID = $derived(backlogStatuses[0]?.id ?? null);
  const backlogStatusIDs = $derived(backlogStatuses.map((status) => status.id));
  const kanbanColumnItems = $derived(activeStatuses.map((status) => ({ id: status.id, label: status.name })));
  const listColumnItems = LIST_COLUMNS.map((column) => ({ id: column.id, label: column.label }));

  const filterPriority = $derived(filters.priority as Priority[]);

  const closedTooltip = "Include cancelled tickets and Done tickets older than 14 days";

  function readVisibleKanbanColumnIDs(): SvelteSet<string> {
    const allIDs = new Set(activeStatuses.map((status) => status.id));
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
  const visibleStatuses = $derived(activeStatuses.filter((status) => visibleKanbanColumnIDs.has(status.id)));

  let searchInput = $state("");
  let searchDebounceID: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    const next = filters.titleSearch ?? "";
    if (searchDebounceID !== null) return;
    searchInput = next;
  });

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
      if (value === null || value === "") next.searchParams.delete(key);
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
      backlog: nextView === "list" ? null : page.url.searchParams.get("backlog"),
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

  function setFilter(name: "status" | "priority" | "assignee" | "label", values: string[]) {
    void updateSearchParams({
      page: null,
      [name]: values.length ? values.join(",") : null,
    });
  }

  function setSearch(value: string) {
    void updateSearchParams({
      page: null,
      q: value.trim() ? value.trim() : null,
    });
  }

  function handleSearchInput(value: string) {
    if (searchDebounceID) clearTimeout(searchDebounceID);
    searchDebounceID = setTimeout(() => {
      searchDebounceID = null;
      setSearch(value);
    }, 250);
  }

  function toggleShowClosed(next: boolean) {
    void updateSearchParams({
      page: null,
      showClosed: next ? "true" : null,
    });
  }

  function toggleBacklog() {
    void updateSearchParams({
      backlog: backlog.open ? null : "true",
    });
  }

  function closeBacklog() {
    void updateSearchParams({ backlog: null });
  }
</script>

<section class="tickets-view">
  <div class="tickets-toolbar">
    <div class="filters" role="group" aria-label="Ticket filters">
      {#if view === "list"}
        <div class="search">
          <SearchInput bind:value={searchInput} placeholder="Search by title…" ariaLabel="Search tickets by title" onInput={handleSearchInput} />
        </div>
      {/if}

      <StatusPicker statuses={orderedStatuses} multi selected={filters.statusID} onChange={(next) => setFilter("status", next)} placeholder="Status" />
      <PriorityPicker multi selected={filterPriority} onChange={(next) => setFilter("priority", next)} placeholder="Priority" />
      <AssigneePicker {members} multi selected={filters.assigneeID} onChange={(next) => setFilter("assignee", next)} placeholder="Assignee" />
      <LabelsPicker {labels} value={filters.labelID} onChange={(next) => setFilter("label", next)} placeholder="Label" />

      <Tooltip label={closedTooltip}>
        <Toggle checked={filters.showClosed} onChange={toggleShowClosed} label="Show closed" size="sm" />
      </Tooltip>
    </div>

    <div class="view-controls" role="group" aria-label="Ticket view controls">
      {#if view === "kanban" && primaryBacklogStatusID}
        <button type="button" class="backlog-toggle" data-active={backlog.open} onclick={toggleBacklog} aria-pressed={backlog.open} aria-label="Toggle backlog drawer">
          <Inbox size={14} />
          Backlog
        </button>
        <span class="control-divider" aria-hidden="true"></span>
      {/if}

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
    <TicketKanban
      projectKey={project.key}
      statuses={visibleStatuses}
      tickets={ticketData.tickets}
      backlogTickets={backlog.tickets}
      {backlogStatusIDs}
      {primaryBacklogStatusID}
      drawerOpen={backlog.open}
      onCloseDrawer={closeBacklog}
      {members}
    />
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
    align-items: center;
    justify-content: space-between;
    gap: 0.6em;
    flex-wrap: wrap;
  }

  .filters {
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    flex-wrap: wrap;
  }

  .search {
    width: 18em;
    max-width: 100%;
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

  .backlog-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    padding: 0.4em 0.65em;
    border: none;
    border-radius: var(--border-radius-inner);
    background: transparent;
    color: var(--colour-text-secondary);
    font: inherit;
    font-size: 0.8em;
    font-weight: 600;
    cursor: pointer;
  }

  .backlog-toggle:hover,
  .backlog-toggle:focus-visible {
    color: var(--colour-text);
    background: var(--colour-bg-hover);
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
    font-size: 0.8em;
    font-weight: 600;
    cursor: pointer;
  }

  .view-toggle button:hover {
    color: var(--colour-text);
    background: var(--colour-bg-hover);
  }

  .backlog-toggle[data-active="true"],
  .view-toggle button.active {
    color: white;
    background: linear-gradient(180deg, color-mix(in oklch, var(--accent-base) 85%, white 15%), var(--accent-base));
    box-shadow:
      rgb(from var(--colour-text) r g b / 0.2) 0px 1px 2px,
      rgb(255 255 255 / 0.15) 0px 1px 0px inset;
  }

  .control-divider {
    align-self: stretch;
    width: 1px;
    margin: 0.2em 0.35em;
    background: var(--colour-border);
  }
</style>
