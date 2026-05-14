<script lang="ts">
  import type { ProjectDetail } from "@issues/api";
  import { Columns3, List as ListIcon, Plus } from "@lucide/svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import ColumnPicker from "$lib/components/kanban/ColumnPicker.svelte";
  import type { TicketListColumnID } from "$lib/components/tickets/TicketList.svelte";
  import { LIST_COLUMNS } from "$lib/components/tickets/TicketList.svelte";

  interface WorkHeaderProps {
    project: ProjectDetail;
    view: "kanban" | "list";
    kanbanPickerStatuses: { id: string; label: string }[];
    visibleKanbanStatusIDs: Set<string>;
    visibleListColumnIDs: Set<TicketListColumnID>;
    onSetView: (next: "kanban" | "list") => void;
    onToggleKanbanColumn: (id: string) => void;
    onToggleListColumn: (id: string) => void;
    onOpenCreate: () => void;
  }

  let {
    project,
    view,
    kanbanPickerStatuses,
    visibleKanbanStatusIDs,
    visibleListColumnIDs,
    onSetView,
    onToggleKanbanColumn,
    onToggleListColumn,
    onOpenCreate,
  }: WorkHeaderProps = $props();
</script>

<header class="pane-head">
  <div class="title">
    <span class="project-key">{project.key}</span>
    <h1>{project.name}</h1>
  </div>
  <div class="actions">
    <div class="view-toggle">
      <button type="button" class:active={view === "list"} onclick={() => onSetView("list")} aria-pressed={view === "list"}>
        <ListIcon size={13} />List
      </button>
      <button type="button" class:active={view === "kanban"} onclick={() => onSetView("kanban")} aria-pressed={view === "kanban"}>
        <Columns3 size={13} />Kanban
      </button>
    </div>

    {#if view === "kanban"}
      <ColumnPicker
        items={kanbanPickerStatuses}
        visible={visibleKanbanStatusIDs}
        onToggle={onToggleKanbanColumn}
        variant="secondary"
      />
    {:else}
      <ColumnPicker
        items={LIST_COLUMNS.map((c) => ({ id: c.id, label: c.label }))}
        visible={visibleListColumnIDs as Set<string>}
        onToggle={onToggleListColumn}
        variant="secondary"
      />
    {/if}

    <Button variant="primary" size="md" onclick={onOpenCreate}>
      <Plus size={13} strokeWidth={4} />
      New ticket
    </Button>
  </div>
</header>

<style>
  .pane-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5em;
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
    flex-wrap: wrap;
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
    }
  }

  .actions {
    display: inline-flex;
    align-items: center;
    gap: 0.5em;
  }

  .view-toggle {
    display: inline-flex;
    background: var(--colour-bg-lighter);
    border: var(--border);
    border-radius: var(--border-radius-inner);
    overflow: hidden;
    box-shadow:
      0 1px 2px rgba(30, 34, 41, 0.07),
      inset 0 1px 0 rgba(255, 255, 255, 0.9);
    transition:
      background 0.12s,
      box-shadow 0.12s;

    button {
      display: inline-flex;
      align-items: center;
      gap: 0.35em;
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 0.8em;
      font-weight: 600;
      padding: 0.45em 0.75em;
      color: var(--colour-text-secondary);
      transition:
        background 0.12s,
        color 0.12s,
        transform 0.06s;

      &:hover {
        color: var(--colour-text);
        background: var(--colour-bg-hover);
      }

      &.active {
        color: white;
        background: linear-gradient(180deg, #4a6ee8, var(--accent-base));
        border: 1px solid var(--accent-shade-100);
        box-shadow:
          rgba(30, 34, 41, 0.2) 0 1px 3px,
          rgba(255, 255, 255, 0.14) 0 1px 0 inset;

        &:active {
          transform: translateY(1px);
          box-shadow:
            rgba(30, 34, 41, 0.25) 0 0 1px,
            rgba(255, 255, 255, 0.08) 0 1px 0 inset;
        }
      }
    }
  }
</style>
