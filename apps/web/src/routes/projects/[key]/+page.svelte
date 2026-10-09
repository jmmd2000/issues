<script lang="ts">
  import { fade } from "svelte/transition";
  import { quartOut } from "svelte/easing";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import type { PageProps } from "./$types";
  import type { Priority, Ticket } from "@issues/api";
  import { PRIORITIES } from "@issues/shared";
  import ActiveFilterChips, { type ActiveFilter } from "$lib/components/projectDetail/ActiveFilterChips.svelte";
  import FilterPanel from "$lib/components/projectDetail/FilterPanel.svelte";
  import WorkHeader from "$lib/components/projectDetail/WorkHeader.svelte";
  import InfoPane from "$lib/components/projectDetail/InfoPane.svelte";
  import TicketKanban from "$lib/components/kanban/TicketKanban.svelte";
  import TicketList, { LIST_COLUMNS, type TicketListColumnID, type TicketListSortDirection } from "$lib/components/tickets/TicketList.svelte";
  import TicketModal from "$lib/components/tickets/TicketModal.svelte";

  let { data }: PageProps = $props();

  const project = $derived(data.project);
  const canEdit = $derived(!!data.user);

  // The slug "backlog" identifies the dedicated Backlog status seeded with
  // every project. The "Include backlog" toggle gates this specific status;
  // other backlog-category statuses (e.g. "Todo") stay visible regardless.
  const backlogStatusID = $derived(project.statuses.find(s => s.slug === "backlog")?.id ?? null);

  const view = $derived(data.view);
  const showClosed = $derived(data.showClosed);
  const includeBacklog = $derived(data.includeBacklog);
  const titleSearch = $derived(data.titleSearch);
  const selectedStatusIDs = $derived(data.filters.statusID);
  const selectedPriorities = $derived(data.filters.priority);
  const selectedAssigneeIDs = $derived(data.filters.assigneeID);
  const selectedLabelIDs = $derived(data.filters.labelID);
  const sortBy = $derived(data.sort.by);
  const sortDir = $derived(data.sort.dir);
  const listPage = $derived(data.pagination.page);

  function updateParams(updates: Record<string, string | null>) {
    const next = new URL(page.url);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") next.searchParams.delete(key);
      else next.searchParams.set(key, value);
    }
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- next.pathname is the current URL's path, which already includes the base
    void goto(`${next.pathname}${next.search}`, { keepFocus: true, noScroll: true });
  }

  function toggleEntry(current: readonly string[], value: string): string[] {
    return current.includes(value) ? current.filter(v => v !== value) : [...current, value];
  }

  function setView(next: "kanban" | "list") {
    updateParams({ view: next === "list" ? "list" : null, page: null });
  }
  function setShowClosed(next: boolean) {
    updateParams({ showClosed: next ? "true" : null, page: null });
  }
  function setIncludeBacklog(next: boolean) {
    updateParams({ includeBacklog: next ? null : "false", page: null });
  }
  function toggleStatusFilter(id: string) {
    const next = toggleEntry(selectedStatusIDs, id);
    updateParams({ status: next.length ? next.join(",") : null, page: null });
  }
  function togglePriorityFilter(p: Priority) {
    const next = toggleEntry(selectedPriorities, p);
    updateParams({ priority: next.length ? next.join(",") : null, page: null });
  }
  function toggleAssigneeFilter(id: string) {
    const next = toggleEntry(selectedAssigneeIDs, id);
    updateParams({ assignee: next.length ? next.join(",") : null, page: null });
  }
  function toggleLabelFilter(id: string) {
    const next = toggleEntry(selectedLabelIDs, id);
    updateParams({ label: next.length ? next.join(",") : null, page: null });
  }
  function clearAllFilters() {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = null;
    searchInput = "";
    updateParams({ q: null, status: null, priority: null, assignee: null, label: null, showClosed: null, includeBacklog: null, page: null });
  }
  function handleSortChange(column: TicketListColumnID | null, direction: TicketListSortDirection | null) {
    updateParams({ sortBy: column, sortDir: direction });
  }
  function handleListPageChange(nextPage: number) {
    updateParams({ view: "list", page: String(nextPage) });
  }

  // svelte-ignore state_referenced_locally
  let searchInput = $state(titleSearch);
  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  // Re-sync from the URL when not mid-debounce. Skip when nothing changed
  $effect(() => {
    if (searchTimer === null && searchInput !== titleSearch) searchInput = titleSearch;
  });
  function handleSearchInput(value: string) {
    searchInput = value;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchTimer = null;
      updateParams({ q: value.trim() || null, page: null });
    }, 200);
  }

  // svelte-ignore state_referenced_locally
  const kanbanColumnsKey = `kanban-columns:${data.project.id}`;
  // svelte-ignore state_referenced_locally
  const listColumnsKey = `list-columns:${data.project.id}`;

  function readVisibleSet<T extends string>(key: string, fallback: T[]): Set<T> {
    if (typeof localStorage === "undefined") return new Set(fallback);
    const raw = localStorage.getItem(key);
    if (!raw) return new Set(fallback);
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Set(fallback);
      const allowed = new Set(fallback);
      const filtered = parsed.filter((v): v is T => typeof v === "string" && allowed.has(v as T));
      return new Set(filtered.length > 0 ? filtered : fallback);
    } catch {
      return new Set(fallback);
    }
  }
  function writeVisibleSet(key: string, value: Set<string>) {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, JSON.stringify([...value]));
  }

  // svelte-ignore state_referenced_locally
  let visibleKanbanStatusIDs = $state<Set<string>>(
    readVisibleSet(
      kanbanColumnsKey,
      data.project.statuses.map(s => s.id)
    )
  );
  let visibleListColumnIDs = $state<Set<TicketListColumnID>>(readVisibleSet<TicketListColumnID>(listColumnsKey, LIST_COLUMNS.map(c => c.id) as TicketListColumnID[]));

  function toggleKanbanColumn(id: string) {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- copied then reassigned to the $state, so the update is still reactive
    const next = new Set(visibleKanbanStatusIDs);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    visibleKanbanStatusIDs = next;
    writeVisibleSet(kanbanColumnsKey, next);
  }
  function toggleListColumn(id: string) {
    const columnID = id as TicketListColumnID;
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- copied then reassigned to the $state, so the update is still reactive
    const next = new Set(visibleListColumnIDs);
    if (next.has(columnID)) {
      if (next.size === 1) return;
      next.delete(columnID);
    } else {
      next.add(columnID);
    }
    visibleListColumnIDs = next;
    writeVisibleSet(listColumnsKey, next as Set<string>);
  }

  const INFO_COLLAPSED_KEY = "project-info-collapsed";

  function readInfoCollapsed(): boolean {
    if (typeof localStorage === "undefined") return true;
    return localStorage.getItem(INFO_COLLAPSED_KEY) !== "false";
  }
  function toggleInfoCollapsed() {
    infoCollapsed = !infoCollapsed;
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(INFO_COLLAPSED_KEY, String(infoCollapsed));
  }

  let createOpen = $state(false);
  let infoCollapsed = $state(readInfoCollapsed());

  // Server-side filters already applied, the only client filter left is the
  // "Include backlog" toggle hiding tickets in the dedicated Backlog status.
  function applyBacklogToggle(tickets: Ticket[]): Ticket[] {
    if (includeBacklog || !backlogStatusID) return tickets;
    return tickets.filter(t => t.statusID !== backlogStatusID);
  }

  // /board excludes backlog-category tickets, so merge /backlog in for kanban.
  const kanbanTickets = $derived(applyBacklogToggle([...data.boardTickets, ...data.backlogTickets]));
  const listTickets = $derived(applyBacklogToggle(data.listTickets));

  const kanbanVisibleStatuses = $derived(
    project.statuses.filter(s => {
      if (!showClosed && s.category === "cancelled") return false;
      if (!includeBacklog && s.id === backlogStatusID) return false;
      if (!visibleKanbanStatusIDs.has(s.id)) return false;
      return true;
    })
  );

  function buildActiveFilters(): ActiveFilter[] {
    const filters: ActiveFilter[] = [];
    for (const status of project.statuses) {
      if (!selectedStatusIDs.includes(status.id)) continue;
      filters.push({ id: `status:${status.id}`, group: "Status", label: status.name, remove: () => toggleStatusFilter(status.id) });
    }
    for (const priority of PRIORITIES) {
      if (!selectedPriorities.includes(priority)) continue;
      const label = priority.charAt(0).toUpperCase() + priority.slice(1);
      filters.push({ id: `priority:${priority}`, group: "Priority", label, remove: () => togglePriorityFilter(priority) });
    }
    for (const member of project.members) {
      if (!selectedAssigneeIDs.includes(member.userID)) continue;
      filters.push({ id: `assignee:${member.userID}`, group: "Assignee", label: member.user.name, remove: () => toggleAssigneeFilter(member.userID) });
    }
    for (const label of project.labels) {
      if (!selectedLabelIDs.includes(label.id)) continue;
      filters.push({ id: `label:${label.id}`, group: "Label", label: label.name, remove: () => toggleLabelFilter(label.id) });
    }
    if (showClosed) {
      filters.push({ id: "option:closed", group: "Show", label: "Closed", remove: () => setShowClosed(false) });
    }
    if (!includeBacklog) {
      filters.push({ id: "option:backlog", group: "Hide", label: "Backlog", remove: () => setIncludeBacklog(true) });
    }
    return filters;
  }

  const activeFilters = $derived(buildActiveFilters());

  const kanbanPickerStatuses = $derived(
    project.statuses.filter(s => (showClosed || s.category !== "cancelled") && (includeBacklog || s.id !== backlogStatusID)).map(s => ({ id: s.id, label: s.name }))
  );
</script>

<svelte:head>
  <title>{project.name} · Issues</title>
</svelte:head>

<section class="project-detail" style:--right-col={infoCollapsed ? "3rem" : "clamp(320px, 24vw, 440px)"}>
  <div class="work">
    <WorkHeader
      {project}
      {view}
      {searchInput}
      activeFilterCount={activeFilters.length}
      {kanbanPickerStatuses}
      {visibleKanbanStatusIDs}
      {visibleListColumnIDs}
      {canEdit}
      onSearchInput={handleSearchInput}
      onSetView={setView}
      onToggleKanbanColumn={toggleKanbanColumn}
      onToggleListColumn={toggleListColumn}
      onOpenCreate={() => (createOpen = true)}
    >
      {#snippet filterPanel()}
        <FilterPanel
          {showClosed}
          {includeBacklog}
          {selectedStatusIDs}
          {selectedPriorities}
          {selectedAssigneeIDs}
          {selectedLabelIDs}
          statuses={project.statuses}
          members={project.members}
          labels={project.labels}
          onShowClosedChange={setShowClosed}
          onIncludeBacklogChange={setIncludeBacklog}
          onToggleStatus={toggleStatusFilter}
          onTogglePriority={togglePriorityFilter}
          onToggleAssignee={toggleAssigneeFilter}
          onToggleLabel={toggleLabelFilter}
        />
      {/snippet}
    </WorkHeader>

    {#if activeFilters.length > 0}
      <ActiveFilterChips filters={activeFilters} onClearAll={clearAllFilters} />
    {/if}

    <div class="work-body">
      {#key view}
        <div class="view-frame" in:fade={{ duration: 180, easing: quartOut }} out:fade={{ duration: 100, easing: quartOut }}>
          {#if view === "kanban"}
            <TicketKanban projectKey={project.key} statuses={kanbanVisibleStatuses} tickets={kanbanTickets} members={project.members} {canEdit} />
          {:else}
            <TicketList
              projectKey={project.key}
              statuses={project.statuses}
              members={project.members}
              tickets={listTickets}
              visibleColumnIDs={visibleListColumnIDs}
              sortColumn={sortBy}
              sortDirection={sortDir}
              page={listPage}
              perPage={data.pagination.perPage}
              total={data.listTotal}
              onSortChange={handleSortChange}
              onPageChange={handleListPageChange}
            />
          {/if}
        </div>
      {/key}
    </div>
  </div>

  <div class="info-rail">
    <InfoPane {project} stats={data.stats} activity={data.activity} collapsed={infoCollapsed} onToggleCollapsed={toggleInfoCollapsed} />
  </div>
</section>

{#if data.user}
  <TicketModal
    open={createOpen}
    mode="create"
    projectKey={project.key}
    statuses={project.statuses}
    labels={project.labels}
    members={project.members}
    currentUserID={data.user.id}
    onclose={() => (createOpen = false)}
  />
{/if}

<style>
  .project-detail {
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--right-col);
    gap: 0;
    margin: -2rem -2rem 0;
    transition: grid-template-columns var(--motion-base) var(--ease-out-expo);
  }

  .work {
    display: flex;
    flex-direction: column;
    min-width: 0;
    background: var(--colour-bg-lighter);
  }

  .work-body {
    padding: 0.9em 1.3em 2em;
    position: relative;
  }

  .view-frame {
    will-change: opacity;
  }

  .info-rail {
    display: flex;
    min-width: 0;

    & > :global(*) {
      flex: 1;
    }
  }

  @media (max-width: 1100px) {
    .project-detail {
      grid-template-columns: minmax(0, 1fr);
    }

    .info-rail {
      display: none;
    }
  }
</style>
