<script lang="ts">
  import { goto } from "$app/navigation";
  import { navigating, page } from "$app/state";
  import { Search, X } from "@lucide/svelte";
  import type { Priority, SearchSortColumn, SearchSortDirection } from "@issues/api";
  import type { SearchPageResult, SearchPageState } from "$lib/api/search";
  import { defaultSearchSortColumn, defaultSearchSortDirection, serialiseSearchPageState } from "$lib/api/search";
  import Button from "$lib/components/ui/Button.svelte";
  import SearchInput from "$lib/components/ui/SearchInput.svelte";
  import SearchFiltersPane from "./SearchFiltersPane.svelte";
  import SearchResultCard from "./SearchResultCard.svelte";

  interface SearchPageProps {
    search: SearchPageResult;
    lockedProjectKey?: string | null;
  }

  let { search, lockedProjectKey = null }: SearchPageProps = $props();

  const normalisedLockedProjectKey = $derived(lockedProjectKey?.toUpperCase() ?? null);
  const searchState = $derived(search.state);
  const selectedProject = $derived(search.filters.projects.find((project) => project.key === searchState.projectKey) ?? null);
  const title = $derived(normalisedLockedProjectKey ? `${selectedProject?.name ?? normalisedLockedProjectKey} search` : "Search");
  const subtitle = $derived(normalisedLockedProjectKey ? normalisedLockedProjectKey : "All visible projects");
  const activeFilterCount = $derived(
    (normalisedLockedProjectKey || !searchState.projectKey ? 0 : 1) + searchState.statusSlugs.length + searchState.priorities.length + searchState.labelNames.length + searchState.assigneeIDs.length
  );
  const hasTypedQuery = $derived(searchState.searchTerm.trim().length > 0);
  const sortColumns = $derived([
    ...(hasTypedQuery ? [{ value: "relevance" as const, label: "Relevance" }] : []),
    { value: "updatedAt" as const, label: "Updated" },
    { value: "createdAt" as const, label: "Created" },
    { value: "title" as const, label: "Title" },
  ] satisfies { value: SearchSortColumn; label: string }[]);
  const sortDirections = $derived(
    searchState.sortBy === "relevance"
      ? [
          { value: "desc" as const, label: "Most relevant" },
          { value: "asc" as const, label: "Least relevant" },
        ]
      : searchState.sortBy === "title"
        ? [
            { value: "asc" as const, label: "A-Z" },
            { value: "desc" as const, label: "Z-A" },
        ]
      : [
          { value: "desc" as const, label: "Newest" },
          { value: "asc" as const, label: "Oldest" },
        ]
  );
  const isLoading = $derived(Boolean(navigating.to));
  const resultSummary = $derived(search.searched ? `${search.tickets.length}${search.hasNextPage ? "+" : ""} result${search.tickets.length === 1 && !search.hasNextPage ? "" : "s"}` : "No search");

  let filtersCollapsed = $state(false);
  // svelte-ignore state_referenced_locally
  let searchInput = $state(search.state.searchTerm);
  const hasPendingQuery = $derived(searchInput.trim().length > 0);
  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    if (searchTimer === null && searchInput !== searchState.searchTerm) searchInput = searchState.searchTerm;
  });

  function updateState(updates: Partial<SearchPageState>, resetPage = true) {
    const projectKey = normalisedLockedProjectKey ?? ("projectKey" in updates ? (updates.projectKey ?? null) : searchState.projectKey);
    const searchTerm = "searchTerm" in updates ? (updates.searchTerm ?? "") : searchState.searchTerm;
    const requestedSortBy = "sortBy" in updates ? updates.sortBy : searchState.sortBy;
    const sortBy = defaultSearchSortColumn(searchTerm, requestedSortBy);
    const requestedSortDirection = "sortDirection" in updates ? updates.sortDirection : sortBy === searchState.sortBy ? searchState.sortDirection : undefined;
    const nextState: SearchPageState = {
      ...searchState,
      ...updates,
      searchTerm,
      page: resetPage ? 1 : (updates.page ?? searchState.page),
      projectKey,
      sortBy,
      sortDirection: defaultSearchSortDirection(sortBy, requestedSortDirection),
    };
    const params = serialiseSearchPageState(nextState, normalisedLockedProjectKey);
    const queryString = params.toString();
    void goto(queryString ? `${page.url.pathname}?${queryString}` : page.url.pathname, { keepFocus: true, noScroll: true });
  }

  function toggleEntry<T extends string>(current: readonly T[], value: T): T[] {
    return current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
  }

  function handleSearchInput(value: string) {
    searchInput = value;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchTimer = null;
      const searchTerm = value.trim();
      const currentDefaultSortBy = defaultSearchSortColumn(searchState.searchTerm);
      const sortBy = searchState.sortBy === currentDefaultSortBy ? defaultSearchSortColumn(searchTerm) : searchState.sortBy;
      const sortDirection = sortBy === searchState.sortBy ? searchState.sortDirection : defaultSearchSortDirection(sortBy);
      updateState({ searchTerm, sortBy, sortDirection });
    }, 220);
  }

  function setSortColumn(event: Event) {
    const sortBy = (event.currentTarget as HTMLSelectElement).value as SearchSortColumn;
    updateState({ sortBy, sortDirection: defaultSearchSortDirection(sortBy) });
  }

  function setSortDirection(event: Event) {
    updateState({ sortDirection: (event.currentTarget as HTMLSelectElement).value as SearchSortDirection });
  }

  function setProjectFilter(projectKey: string | null) {
    updateState({ projectKey });
  }

  function toggleStatusFilter(slug: string) {
    updateState({ statusSlugs: toggleEntry(searchState.statusSlugs, slug) });
  }

  function togglePriorityFilter(priority: Priority) {
    updateState({ priorities: toggleEntry(searchState.priorities, priority) });
  }

  function toggleAssigneeFilter(userID: string) {
    updateState({ assigneeIDs: toggleEntry(searchState.assigneeIDs, userID) });
  }

  function toggleLabelFilter(name: string) {
    updateState({ labelNames: toggleEntry(searchState.labelNames, name) });
  }

  function resetFilters() {
    updateState({
      projectKey: normalisedLockedProjectKey,
      statusSlugs: [],
      priorities: [],
      labelNames: [],
      assigneeIDs: [],
      sortBy: "updatedAt",
      sortDirection: "desc",
    });
  }

  function clearSearch() {
    if (searchTimer) {
      clearTimeout(searchTimer);
      searchTimer = null;
    }
    searchInput = "";
    updateState({
      searchTerm: "",
      projectKey: normalisedLockedProjectKey,
      statusSlugs: [],
      priorities: [],
      labelNames: [],
      assigneeIDs: [],
    });
  }

  function setPage(nextPage: number) {
    updateState({ page: nextPage }, false);
  }
</script>

<section class="search-page" style:--left-col={filtersCollapsed ? "3rem" : "clamp(260px, 18vw, 360px)"}>
  <SearchFiltersPane
    filters={search.filters}
    {searchState}
    lockedProjectKey={normalisedLockedProjectKey}
    collapsed={filtersCollapsed}
    {activeFilterCount}
    onProjectChange={setProjectFilter}
    onToggleStatus={toggleStatusFilter}
    onTogglePriority={togglePriorityFilter}
    onToggleAssignee={toggleAssigneeFilter}
    onToggleLabel={toggleLabelFilter}
    onResetFilters={resetFilters}
    onToggleCollapsed={() => (filtersCollapsed = !filtersCollapsed)}
  />

  <main class="work">
    <header class="search-head">
      <div class="title">
        <span>{subtitle}</span>
        <h1>{title}</h1>
      </div>
      <div class="result-count" class:loading={isLoading}>{resultSummary}</div>
    </header>

    <div class="work-body">
      <section class="query-panel" aria-label="Search query">
        <div class="query-row">
          <SearchInput value={searchInput} placeholder="Search tickets..." ariaLabel="Search tickets" onInput={handleSearchInput} />
          {#if hasPendingQuery || hasTypedQuery || activeFilterCount > 0}
            <Button variant="secondary" size="md" onclick={clearSearch}>
              <X size={13} strokeWidth={3} />
              Clear
            </Button>
          {/if}
        </div>
        <div class="syntax-hints" aria-label="Search syntax hints">
          <span><kbd>"exact phrase"</kbd></span>
          <span><kbd>-excluded</kbd></span>
          <span><kbd>api or ui</kbd></span>
        </div>
        <div class="sort-controls" aria-label="Search result sorting">
          <label>
            <span>Sort</span>
            <select value={searchState.sortBy} onchange={setSortColumn}>
              {#each sortColumns as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>

          <label>
            <span>Direction</span>
            <select value={searchState.sortDirection} onchange={setSortDirection}>
              {#each sortDirections as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
        </div>
      </section>

      {#if !search.searched}
        <section class="empty-state">
          <Search size={22} strokeWidth={2.2} />
          <h2>No query or filters selected.</h2>
          <p>Search by ticket title, description, or structured filters.</p>
        </section>
      {:else if search.tickets.length === 0}
        <section class="empty-state">
          <Search size={22} strokeWidth={2.2} />
          <h2>No tickets matched.</h2>
          <p>Broaden the query or remove filters.</p>
        </section>
      {:else}
        <ol class="results" class:loading={isLoading}>
          {#each search.tickets as ticket (ticket.id)}
            <li>
              <SearchResultCard {ticket} />
            </li>
          {/each}
        </ol>

        {#if searchState.page > 1 || search.hasNextPage}
          <nav class="pagination" aria-label="Search result pages">
            <Button variant="secondary" size="md" disabled={searchState.page <= 1} onclick={() => setPage(searchState.page - 1)}>Previous</Button>
            <span>Page {searchState.page}</span>
            <Button variant="secondary" size="md" disabled={!search.hasNextPage} onclick={() => setPage(searchState.page + 1)}>Next</Button>
          </nav>
        {/if}
      {/if}
    </div>
  </main>
</section>

<style>
  .search-page {
    display: grid;
    grid-template-columns: var(--left-col) minmax(0, 1fr);
    gap: 0;
    margin: -2rem -2rem 0;
    transition: grid-template-columns 180ms ease;
  }

  .work {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: calc(100vh - 55px);
    background: var(--colour-bg-lighter);
  }

  .search-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75em;
    padding: 0 1.3em;
    border-bottom: var(--border);
    background: var(--colour-bg-lighter);
    flex-shrink: 0;
    height: 3.5em;
    box-sizing: border-box;
    position: sticky;
    top: 0;
    z-index: 2;
  }

  .title {
    display: flex;
    align-items: baseline;
    gap: 0.6em;
    min-width: 0;

    span {
      font-family: var(--font-mono);
      font-size: 0.75em;
      font-weight: 700;
      color: var(--accent-base);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    h1 {
      font-size: 1.1em;
      font-weight: 600;
      color: var(--colour-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .result-count {
    min-width: max-content;
    padding: 0.25em 0.5em;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg);
    color: var(--colour-text-secondary);
    font-size: 0.75rem;
    font-weight: 600;
    transition: opacity 0.15s;
  }

  .result-count.loading,
  .results.loading {
    opacity: 0.55;
  }

  .work-body {
    display: grid;
    gap: 1rem;
    padding: 1rem 1.3em 2em;
  }

  .query-panel {
    display: grid;
    gap: 0.55rem;
    padding: 0.85rem;
    border: var(--border);
    border-radius: var(--border-radius-outer);
    background: var(--colour-bg);
  }

  .sort-controls {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    flex-wrap: wrap;

    label {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      color: var(--colour-muted);
      font-size: 0.75rem;
      font-weight: 600;
    }

    select {
      min-height: 2rem;
      padding: 0.25em 1.8em 0.25em 0.55em;
      border: var(--border);
      border-radius: var(--border-radius-inner);
      background: var(--colour-bg-lighter);
      color: var(--colour-text);
      font-size: 0.8rem;
      font-weight: 600;
      box-shadow:
        0 1px 2px rgba(30, 34, 41, 0.07),
        inset 0 1px 0 rgba(255, 255, 255, 0.9);
      cursor: pointer;
    }
  }

  .query-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.6rem;
    align-items: center;
  }

  .syntax-hints {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-wrap: wrap;
    color: var(--colour-muted);
    font-size: 0.75rem;
  }

  kbd {
    display: inline-flex;
    align-items: center;
    min-height: 1.5rem;
    padding: 0.15rem 0.45rem;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg-lighter);
    color: var(--colour-text-secondary);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 600;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
  }

  .results {
    display: grid;
    gap: 0.75rem;
    list-style: none;
    transition: opacity 0.15s;
  }

  .empty-state {
    display: grid;
    place-items: center;
    gap: 0.45rem;
    min-height: 18rem;
    padding: 2rem;
    border: 1px dashed var(--colour-border);
    border-radius: var(--border-radius-outer);
    background: var(--colour-bg);
    color: var(--colour-muted);
    text-align: center;

    h2 {
      color: var(--colour-text);
      font-size: 0.95rem;
      font-weight: 600;
    }

    p {
      max-width: 32rem;
      color: var(--colour-text-secondary);
      font-size: 0.85rem;
      line-height: 1.45;
    }
  }

  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.7rem;
    color: var(--colour-muted);
    font-size: 0.8rem;
    font-weight: 600;
  }

  @media (max-width: 720px) {
    .search-page {
      grid-template-columns: 1fr;
    }

    .query-row {
      grid-template-columns: 1fr;
    }

    .search-head {
      align-items: flex-start;
      flex-direction: column;
      height: auto;
      padding: 0.85rem 1rem;
    }

    .title {
      flex-wrap: wrap;
    }

    .work-body {
      padding: 0.85rem 1rem 1.5rem;
    }
  }
</style>
