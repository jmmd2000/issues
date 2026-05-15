<script lang="ts">
  import { resolve } from "$app/paths";
  import type { ProjectDetail } from "@issues/api";
  import { Columns3, List as ListIcon, Plus, Search } from "@lucide/svelte";
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
    canEdit: boolean;
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
    canEdit,
    onSetView,
    onToggleKanbanColumn,
    onToggleListColumn,
    onOpenCreate,
  }: WorkHeaderProps = $props();

  const projectSearchHref = $derived(resolve("/projects/[key]/search", { key: project.key }));
</script>

<header class="pane-head">
  <div class="title">
    <code class="project-key">{project.key}</code>
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

    <Button variant="secondary" size="md" href={projectSearchHref}>
      <Search size={13} strokeWidth={3} />
      Search
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
      0 1px 2px rgb(from var(--colour-text) r g b / 0.07),
      inset 0 1px 0 rgb(from var(--colour-bg-lighter) r g b / 0.9);
    transition:
      background var(--motion-fast) var(--ease-out-quart),
      box-shadow var(--motion-fast) var(--ease-out-quart);

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
        background var(--motion-fast) var(--ease-out-quart),
        color var(--motion-fast) var(--ease-out-quart),
        transform 60ms var(--ease-out-quart);

      &:hover {
        color: var(--colour-text);
        background: var(--colour-bg-hover);
      }

      &.active {
        color: var(--colour-bg-lighter);
        background: linear-gradient(180deg, var(--accent-tint-200), var(--accent-base));
        border: 1px solid var(--accent-shade-100);
        box-shadow:
          rgb(from var(--colour-text) r g b / 0.2) 0 1px 3px,
          rgb(from var(--colour-bg-lighter) r g b / 0.14) 0 1px 0 inset;

        &:active {
          transform: translateY(1px);
          box-shadow:
            rgb(from var(--colour-text) r g b / 0.25) 0 0 1px,
            rgb(from var(--colour-bg-lighter) r g b / 0.08) 0 1px 0 inset;
        }
      }
    }
  }
</style>
