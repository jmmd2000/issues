<script lang="ts">
  import { fade } from "svelte/transition";
  import { quartOut } from "svelte/easing";
  import type { Label, Priority, ProjectMember, Status } from "@issues/api";
  import { PRIORITIES, STATUS_CATEGORIES } from "@issues/shared";
  import { PanelLeftClose, PanelLeftOpen } from "@lucide/svelte";
  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import SearchInput from "$lib/components/ui/SearchInput.svelte";
  import Toggle from "$lib/components/ui/Toggle.svelte";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import LabelChip from "$lib/components/tickets/LabelChip.svelte";
  import PriorityChip from "$lib/components/tickets/PriorityChip.svelte";
  import StatusChip from "$lib/components/tickets/StatusChip.svelte";
  import FilterSection from "./FilterSection.svelte";

  interface FiltersPaneProps {
    searchInput: string;
    showClosed: boolean;
    includeBacklog: boolean;
    selectedStatusIDs: readonly string[];
    selectedPriorities: readonly Priority[];
    selectedAssigneeIDs: readonly string[];
    selectedLabelIDs: readonly string[];
    statuses: Status[];
    members: ProjectMember[];
    labels: Label[];
    collapsed: boolean;
    onSearchInput: (value: string) => void;
    onShowClosedChange: (value: boolean) => void;
    onIncludeBacklogChange: (value: boolean) => void;
    onToggleStatus: (id: string) => void;
    onTogglePriority: (priority: Priority) => void;
    onToggleAssignee: (id: string) => void;
    onToggleLabel: (id: string) => void;
    onToggleCollapsed: () => void;
  }

  let {
    searchInput,
    showClosed,
    includeBacklog,
    selectedStatusIDs,
    selectedPriorities,
    selectedAssigneeIDs,
    selectedLabelIDs,
    statuses,
    members,
    labels,
    collapsed,
    onSearchInput,
    onShowClosedChange,
    onIncludeBacklogChange,
    onToggleStatus,
    onTogglePriority,
    onToggleAssignee,
    onToggleLabel,
    onToggleCollapsed,
  }: FiltersPaneProps = $props();

  const orderedStatuses = $derived([...statuses].sort((a, b) => STATUS_CATEGORIES.indexOf(a.category) - STATUS_CATEGORIES.indexOf(b.category) || a.position - b.position));

  let open = $state({ status: true, priority: true, assignee: true, label: true });

  function toggleOpen(key: keyof typeof open) {
    open[key] = !open[key];
  }
</script>

<aside class="pane" class:collapsed aria-label="Filters">
  <header class="pane-head">
    {#if !collapsed}<h2>Filters</h2>{/if}
    <button type="button" class="collapse-button" onclick={onToggleCollapsed} aria-label={collapsed ? "Expand filters" : "Collapse filters"} title={collapsed ? "Expand filters" : "Collapse filters"}>
      {#if collapsed}<PanelLeftOpen size={14} />{:else}<PanelLeftClose size={14} />{/if}
    </button>
  </header>

  {#if !collapsed}
    <div class="pane-scroll" in:fade={{ duration: 180, easing: quartOut, delay: 80 }} out:fade={{ duration: 120, easing: quartOut }}>
      <SearchInput value={searchInput} placeholder="Search titles" onInput={onSearchInput} />

      <div class="toggles">
        <Toggle checked={showClosed} onChange={onShowClosedChange} label="Show closed" size="sm" />
        <Toggle checked={includeBacklog} onChange={onIncludeBacklogChange} label="Include backlog" size="sm" />
      </div>

      <FilterSection title="Status" open={open.status} count={selectedStatusIDs.length} onToggle={() => toggleOpen("status")}>
        {#each orderedStatuses as status (status.id)}
          <li>
            <Checkbox checked={selectedStatusIDs.includes(status.id)} onchange={() => onToggleStatus(status.id)}>
              <StatusChip name={status.name} category={status.category} />
            </Checkbox>
          </li>
        {/each}
      </FilterSection>

      <FilterSection title="Priority" open={open.priority} count={selectedPriorities.length} onToggle={() => toggleOpen("priority")}>
        {#each PRIORITIES as priority (priority)}
          <li>
            <Checkbox checked={selectedPriorities.includes(priority)} onchange={() => onTogglePriority(priority)}>
              <span class="row">
                <PriorityChip {priority} variant="chip" />
              </span>
            </Checkbox>
          </li>
        {/each}
      </FilterSection>

      <FilterSection title="Assignee" open={open.assignee} count={selectedAssigneeIDs.length} onToggle={() => toggleOpen("assignee")}>
        {#each members as member (member.userID)}
          <li>
            <Checkbox checked={selectedAssigneeIDs.includes(member.userID)} onchange={() => onToggleAssignee(member.userID)}>
              <span class="row">
                <UserAvatar name={member.user.name} avatarURL={member.user.avatarURL} size="sm" />
                <span class="row-label">{member.user.name}</span>
              </span>
            </Checkbox>
          </li>
        {/each}
      </FilterSection>

      {#if labels.length > 0}
        <FilterSection title="Labels" open={open.label} count={selectedLabelIDs.length} onToggle={() => toggleOpen("label")}>
          {#each labels as label (label.id)}
            <li>
              <Checkbox checked={selectedLabelIDs.includes(label.id)} onchange={() => onToggleLabel(label.id)}>
                <LabelChip name={label.name} colour={label.colour} />
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
      transition:
        background var(--motion-fast) var(--ease-out-quart),
        color var(--motion-fast) var(--ease-out-quart);

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

  .toggles {
    display: flex;
    flex-direction: column;
    gap: 0.5em;
  }

  .row {
    display: inline-flex;
    align-items: center;
    gap: 0.45em;
  }

  .row-label {
    overflow-wrap: anywhere;
  }

  @media (max-width: 720px) {
    .pane {
      border-right: none;
      border-bottom: var(--border);
    }
  }
</style>
