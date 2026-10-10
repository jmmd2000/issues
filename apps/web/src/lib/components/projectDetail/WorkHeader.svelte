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

  <div class="controls">
    <div class="search">
      <SearchInput value={searchInput} placeholder="Search titles" onInput={onSearchInput} />
    </div>

    <div class="filters">
      <Popover menuRole="dialog" menuLabel="Filters">
        {#snippet trigger({ toggle, open })}
          <Button variant="secondary" size="md" onclick={toggle} aria-expanded={open} aria-haspopup="dialog">
            <ListFilter size={13} strokeWidth={2.5} />
            <span class="label">Filters</span>
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
        <ListIcon size={13} /><span class="label">List</span>
      </button>
      <button type="button" class:active={view === "kanban"} onclick={() => onSetView("kanban")} aria-pressed={view === "kanban"}>
        <Columns3 size={13} /><span class="label">Kanban</span>
      </button>
    </div>

    <div class="columns">
      {#if view === "kanban"}
        <ColumnPicker items={kanbanPickerStatuses} visible={visibleKanbanStatusIDs} onToggle={onToggleKanbanColumn} variant="secondary" />
      {:else}
        <ColumnPicker items={LIST_COLUMNS.map(c => ({ id: c.id, label: c.label }))} visible={visibleListColumnIDs as Set<string>} onToggle={onToggleListColumn} variant="secondary" />
      {/if}
    </div>

    <div class="project-actions">
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
    /* Sized to the name, so the controls wrap to a new line before the name is cut off. */
    flex: 1 1 auto;

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

  .controls,
  .project-actions {
    display: flex;
    align-items: center;
    gap: 0.5em;
  }

  .controls {
    flex-wrap: wrap;
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

  /* Phones: two rows. The title and the project actions share the first, so
     New ticket stays in view; search and the view controls fill the second. */
  @media (max-width: 720px) {
    .pane-head {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto auto;
      grid-template-areas:
        "title actions actions actions"
        "search filters view columns";
      gap: 0.5em;
      padding: 0.6em 1em;
    }

    /* Lets each control take its own grid cell. */
    .controls {
      display: contents;
    }

    .title {
      grid-area: title;
    }

    .project-actions {
      grid-area: actions;
      justify-content: end;
    }

    .search {
      grid-area: search;
      width: auto;
      min-width: 0;
    }

    .filters {
      grid-area: filters;
    }

    .view-toggle {
      grid-area: view;
    }

    .columns {
      grid-area: columns;
    }

    /* Icon-only controls. The words stay for screen readers. */
    .label,
    .columns :global(.trigger-label) {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    /* The trigger sits mid-row, so the menu spans the header instead of
       hanging off the button. */
    .filters :global(.popover) {
      position: static;
    }

    .filters :global(.popover-menu) {
      top: calc(100% - 0.25em);
      left: 1em;
      right: 1em;
      width: auto;
      max-width: none;
    }
  }
</style>
