<script lang="ts">
  import { PanelLeftClose, PanelLeftOpen, X } from "@lucide/svelte";
  import type { Priority, SearchFilterOptions, Status } from "@issues/api";
  import { PRIORITIES, STATUS_CATEGORIES } from "@issues/shared";
  import type { SearchPageState } from "$lib/api/search";
  import FilterSection from "$lib/components/projectDetail/FilterSection.svelte";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import PriorityChip from "$lib/components/tickets/PriorityChip.svelte";
  import Checkbox from "$lib/components/ui/Checkbox.svelte";

  interface SearchFiltersPaneProps {
    filters: SearchFilterOptions;
    searchState: SearchPageState;
    lockedProjectKey: string | null;
    collapsed: boolean;
    activeFilterCount: number;
    onProjectChange: (projectKey: string | null) => void;
    onToggleStatus: (slug: string) => void;
    onTogglePriority: (priority: Priority) => void;
    onToggleAssignee: (userID: string) => void;
    onToggleLabel: (name: string) => void;
    onResetFilters: () => void;
    onToggleCollapsed: () => void;
  }

  let {
    filters,
    searchState,
    lockedProjectKey,
    collapsed,
    activeFilterCount,
    onProjectChange,
    onToggleStatus,
    onTogglePriority,
    onToggleAssignee,
    onToggleLabel,
    onResetFilters,
    onToggleCollapsed,
  }: SearchFiltersPaneProps = $props();

  const statusColour: Record<Status["category"], string> = {
    backlog: "var(--colour-status-backlog)",
    active: "var(--colour-status-active)",
    done: "var(--colour-status-done)",
    cancelled: "var(--colour-status-cancelled)",
  };

  let open = $state({ project: true, status: true, priority: true, assignee: true, label: true });

  const orderedProjects = $derived([...filters.projects].sort((a, b) => a.key.localeCompare(b.key)));
  const orderedStatuses = $derived([...filters.statuses].sort((a, b) => STATUS_CATEGORIES.indexOf(a.category) - STATUS_CATEGORIES.indexOf(b.category) || a.name.localeCompare(b.name)));
  const orderedLabels = $derived([...filters.labels].sort((a, b) => a.name.localeCompare(b.name)));
  const orderedAssignees = $derived([...filters.assignees].sort((a, b) => a.name.localeCompare(b.name)));

  function toggleOpen(key: keyof typeof open) {
    open[key] = !open[key];
  }
</script>

<aside class="pane" class:collapsed aria-label="Search filters">
  <header class="pane-head">
    {#if !collapsed}<h2>Filters</h2>{/if}
    <button type="button" class="collapse-button" onclick={onToggleCollapsed} aria-label={collapsed ? "Expand filters" : "Collapse filters"} title={collapsed ? "Expand filters" : "Collapse filters"}>
      {#if collapsed}<PanelLeftOpen size={14} />{:else}<PanelLeftClose size={14} />{/if}
    </button>
  </header>

  {#if !collapsed}
    <div class="pane-scroll">
      <div class="filter-summary">
        <span>{activeFilterCount > 0 ? `${activeFilterCount} active` : "No filters"}</span>
        {#if activeFilterCount > 0}
          <button type="button" class="reset-button" onclick={onResetFilters}>
            <X size={12} strokeWidth={2.5} />
            Reset
          </button>
        {/if}
      </div>

      {#if !lockedProjectKey && orderedProjects.length > 0}
        <FilterSection title="Project" open={open.project} count={searchState.projectKey ? 1 : 0} onToggle={() => toggleOpen("project")}>
          <li>
            <button type="button" class="option-button" class:selected={searchState.projectKey === null} onclick={() => onProjectChange(null)} aria-pressed={searchState.projectKey === null}>
              <span class="project-key">All</span>
              <span>All projects</span>
            </button>
          </li>
          {#each orderedProjects as project (project.id)}
            <li>
              <button type="button" class="option-button" class:selected={searchState.projectKey === project.key} onclick={() => onProjectChange(project.key)} aria-pressed={searchState.projectKey === project.key}>
                <span class="project-key">{project.key}</span>
                <span>{project.name}</span>
              </button>
            </li>
          {/each}
        </FilterSection>
      {/if}

      {#if orderedStatuses.length > 0}
        <FilterSection title="Status" open={open.status} count={searchState.statusSlugs.length} onToggle={() => toggleOpen("status")}>
          {#each orderedStatuses as status (`${status.slug}:${status.category}`)}
            <li>
              <Checkbox checked={searchState.statusSlugs.includes(status.slug)} onchange={() => onToggleStatus(status.slug)}>
                <span class="row">
                  <span class="dot" style:--dot={statusColour[status.category]}></span>
                  <span class="row-label">{status.name}</span>
                </span>
              </Checkbox>
            </li>
          {/each}
        </FilterSection>
      {/if}

      <FilterSection title="Priority" open={open.priority} count={searchState.priorities.length} onToggle={() => toggleOpen("priority")}>
        {#each PRIORITIES as priority (priority)}
          <li>
            <Checkbox checked={searchState.priorities.includes(priority)} onchange={() => onTogglePriority(priority)}>
              <span class="row">
                <PriorityChip {priority} variant="chip" />
              </span>
            </Checkbox>
          </li>
        {/each}
      </FilterSection>

      {#if orderedAssignees.length > 0}
        <FilterSection title="Assignee" open={open.assignee} count={searchState.assigneeIDs.length} onToggle={() => toggleOpen("assignee")}>
          {#each orderedAssignees as assignee (assignee.id)}
            <li>
              <Checkbox checked={searchState.assigneeIDs.includes(assignee.id)} onchange={() => onToggleAssignee(assignee.id)}>
                <span class="row">
                  <UserAvatar name={assignee.name} avatarURL={assignee.avatarURL} size="sm" />
                  <span class="row-label">{assignee.name}</span>
                </span>
              </Checkbox>
            </li>
          {/each}
        </FilterSection>
      {/if}

      {#if orderedLabels.length > 0}
        <FilterSection title="Labels" open={open.label} count={searchState.labelNames.length} onToggle={() => toggleOpen("label")}>
          {#each orderedLabels as label (`${label.name}:${label.colour}`)}
            <li>
              <Checkbox checked={searchState.labelNames.includes(label.name)} onchange={() => onToggleLabel(label.name)}>
                <span class="row">
                  <span class="dot" style:--dot={label.colour}></span>
                  <span class="row-label">{label.name}</span>
                </span>
              </Checkbox>
            </li>
          {/each}
        </FilterSection>
      {/if}
    </div>
  {/if}
</aside>

<style>
  .pane {
    display: flex;
    flex-direction: column;
    min-width: 0;
    background: var(--colour-bg);
    border-right: var(--border);
  }

  .pane-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5em;
    padding: 0 0.6em 0 1em;
    border-bottom: var(--border);
    background: var(--colour-bg-lighter);
    flex-shrink: 0;
    height: 3.5em;
    box-sizing: border-box;
    position: sticky;
    top: 0;
    z-index: 2;

    h2 {
      font-size: 0.7em;
      font-weight: 700;
      color: var(--colour-muted);
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .collapse-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.8rem;
      height: 1.8rem;
      padding: 0;
      border: none;
      background: transparent;
      color: var(--colour-muted);
      cursor: pointer;
      border-radius: var(--border-radius-inner);

      &:hover {
        color: var(--colour-text);
        background: var(--colour-bg-hover);
      }
    }
  }

  .pane.collapsed .pane-head {
    justify-content: center;
    padding: 0;
  }

  .pane-scroll {
    padding: 0.9em 1em;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1em;
  }

  .filter-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    color: var(--colour-muted);
    font-size: 0.75rem;
    font-weight: 600;
  }

  .reset-button {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.3em 0.45em;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg-lighter);
    color: var(--colour-text-secondary);
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 600;

    &:hover {
      background: var(--colour-bg-hover);
      color: var(--colour-text);
    }
  }

  .option-button {
    display: grid;
    grid-template-columns: 3.5rem minmax(0, 1fr);
    align-items: baseline;
    gap: 0.5rem;
    width: 100%;
    padding: 0.45em 0.4em;
    border: none;
    border-radius: var(--border-radius-inner);
    background: transparent;
    color: var(--colour-text-secondary);
    cursor: pointer;
    text-align: left;
    font-size: 0.8rem;

    &:hover,
    &.selected {
      background: var(--colour-bg-lighter);
      color: var(--colour-text);
    }

    &.selected {
      box-shadow: inset 0 0 0 1px var(--colour-border);
    }

    span:last-child {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .project-key {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--accent-base);
    text-transform: uppercase;
  }

  .row {
    display: inline-flex;
    align-items: center;
    gap: 0.45em;
    min-width: 0;
  }

  .row-label {
    overflow-wrap: anywhere;
  }

  .dot {
    display: inline-block;
    width: 0.6em;
    height: 0.6em;
    border-radius: 999px;
    background: var(--dot, var(--colour-muted));
    flex-shrink: 0;
  }

  @media (max-width: 720px) {
    .pane {
      border-right: none;
      border-bottom: var(--border);
    }
  }
</style>
