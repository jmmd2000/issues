<script lang="ts">
  import type { Snippet } from "svelte";
  import { resolve } from "$app/paths";
  import type { ProjectDetail } from "@issues/api";
  import { Columns3, List as ListIcon, ListFilter, Plus, Settings } from "@lucide/svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Popover from "$lib/components/ui/Popover.svelte";
  import SearchInput from "$lib/components/ui/SearchInput.svelte";
  import ColumnPicker from "$lib/components/kanban/ColumnPicker.svelte";
  import type { TicketListColumnID } from "$lib/components/tickets/TicketList.svelte";
  import { LIST_COLUMNS } from "$lib/components/tickets/TicketList.svelte";

  interface WorkHeaderProps {
    project: ProjectDetail;
    view: "kanban" | "list";
    searchInput: string;
    activeFilterCount: number;
    kanbanPickerStatuses: { id: string; label: string }[];
    visibleKanbanStatusIDs: Set<string>;
    visibleListColumnIDs: Set<TicketListColumnID>;
    canEdit: boolean;
    /** Contents of the Filters popover. */
    filterPanel: Snippet;
    onSearchInput: (value: string) => void;
    onSetView: (next: "kanban" | "list") => void;
    onToggleKanbanColumn: (id: string) => void;
    onToggleListColumn: (id: string) => void;
    onOpenCreate: () => void;
  }

  let {
    project,
    view,
    searchInput,
    activeFilterCount,
    kanbanPickerStatuses,
    visibleKanbanStatusIDs,
    visibleListColumnIDs,
    canEdit,
    filterPanel,
    onSearchInput,
    onSetView,
    onToggleKanbanColumn,
    onToggleListColumn,
    onOpenCreate,
  }: WorkHeaderProps = $props();

  const settingsHref = $derived(resolve("/projects/[key]/settings", { key: project.key }));
</script>

<header class="pane-head">
  <div class="title">
    <code class="project-key">{project.key}</code>
    <h1>{project.name}</h1>
  </div>

  <div class="actions">
    <div class="search">
      <SearchInput value={searchInput} placeholder="Search titles" onInput={onSearchInput} />
    </div>

    <div class="filters">
      <Popover menuRole="dialog" menuLabel="Filters">
        {#snippet trigger({ toggle, open })}
          <Button variant="secondary" size="md" onclick={toggle} aria-expanded={open} aria-haspopup="dialog">
            <ListFilter size={13} strokeWidth={2.5} />
            Filters
            {#if activeFilterCount > 0}<span class="count">{activeFilterCount}</span>{/if}
          </Button>
        {/snippet}
        {#snippet menu()}
          {@render filterPanel()}
        {/snippet}
      </Popover>
    </div>

    <div class="view-toggle" role="group" aria-label="View">
      <button type="button" class:active={view === "list"} onclick={() => onSetView("list")} aria-pressed={view === "list"}>
        <ListIcon size={13} />List
      </button>
      <button type="button" class:active={view === "kanban"} onclick={() => onSetView("kanban")} aria-pressed={view === "kanban"}>
        <Columns3 size={13} />Kanban
      </button>
    </div>

    {#if view === "kanban"}
      <ColumnPicker items={kanbanPickerStatuses} visible={visibleKanbanStatusIDs} onToggle={onToggleKanbanColumn} variant="secondary" />
    {:else}
      <ColumnPicker items={LIST_COLUMNS.map(c => ({ id: c.id, label: c.label }))} visible={visibleListColumnIDs as Set<string>} onToggle={onToggleListColumn} variant="secondary" />
    {/if}

    <Button variant="secondary" size="md" href={settingsHref} aria-label="Project settings" title="Project settings">
      <Settings size={14} />
    </Button>

    {#if canEdit}
      <Button variant="primary" size="md" onclick={onOpenCreate}>
        <Plus size={13} strokeWidth={4} />
        New ticket
      </Button>
    {/if}
  </div>
</header>

<style>
  .pane-head {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5em 1em;
    min-height: 3.5em;
    padding: 0.5em 1.25em;
    border-bottom: var(--border);
    background: var(--colour-bg-lighter);
    box-sizing: border-box;
    position: sticky;
    top: 0;
    z-index: 3;
  }

  .title {
    display: flex;
    align-items: baseline;
    gap: 0.6em;
    min-width: 0;
    flex: 1;

    .project-key {
      font-family: var(--font-mono);
      font-size: 0.8em;
      font-weight: 600;
      color: var(--accent-base);
      letter-spacing: 0.05em;
    }

    h1 {
      font-size: 1.1em;
      font-weight: 600;
      color: var(--colour-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5em;
  }

  .search {
    width: 14rem;
  }

  .count {
    font-family: var(--font-mono);
    font-size: 0.85em;
    font-weight: 700;
    padding: 0 0.4em;
    border-radius: 999px;
    background: var(--accent-tint-800);
    color: var(--accent-shade-200);
  }

  /* The trigger sits near the right edge, so the popover opens leftwards. */
  .filters :global(.popover-menu) {
    left: auto;
    right: 0;
    width: 32rem;
    max-width: calc(100vw - 2rem);
    max-height: 70vh;
    overflow-y: auto;
  }

  .view-toggle {
    display: inline-flex;
    gap: 0.15em;
    padding: 0.15em;
    background: var(--colour-bg);
    border: var(--border);
    border-radius: var(--border-radius-inner);

    button {
      display: inline-flex;
      align-items: center;
      gap: 0.35em;
      background: transparent;
      border: 1px solid transparent;
      border-radius: var(--border-radius-inner);
      cursor: pointer;
      font-size: 0.8em;
      font-weight: 600;
      padding: 0.35em 0.7em;
      color: var(--colour-muted);
      transition:
        background var(--motion-fast) var(--ease-out-quart),
        color var(--motion-fast) var(--ease-out-quart);

      &:hover {
        color: var(--colour-text);
      }

      &.active {
        color: var(--colour-text);
        background: var(--colour-bg-lighter);
        border-color: var(--colour-border);
        box-shadow: var(--box-shadow);
      }
    }
  }

  @media (max-width: 720px) {
    .title {
      flex-basis: 100%;
    }

    .actions {
      width: 100%;
    }

    .search {
      width: 100%;
    }

    .filters :global(.popover-menu) {
      right: auto;
      left: 0;
    }
  }
</style>
