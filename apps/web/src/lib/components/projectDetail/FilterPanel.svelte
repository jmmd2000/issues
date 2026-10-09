<script lang="ts">
  import type { Label, Priority, ProjectMember, Status } from "@issues/api";
  import { PRIORITIES, STATUS_CATEGORIES } from "@issues/shared";
  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import Toggle from "$lib/components/ui/Toggle.svelte";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import LabelChip from "$lib/components/tickets/LabelChip.svelte";
  import PriorityChip from "$lib/components/tickets/PriorityChip.svelte";
  import StatusChip from "$lib/components/tickets/StatusChip.svelte";

  interface FilterPanelProps {
    showClosed: boolean;
    includeBacklog: boolean;
    selectedStatusIDs: readonly string[];
    selectedPriorities: readonly Priority[];
    selectedAssigneeIDs: readonly string[];
    selectedLabelIDs: readonly string[];
    statuses: Status[];
    members: ProjectMember[];
    labels: Label[];
    onShowClosedChange: (value: boolean) => void;
    onIncludeBacklogChange: (value: boolean) => void;
    onToggleStatus: (id: string) => void;
    onTogglePriority: (priority: Priority) => void;
    onToggleAssignee: (id: string) => void;
    onToggleLabel: (id: string) => void;
  }

  let {
    showClosed,
    includeBacklog,
    selectedStatusIDs,
    selectedPriorities,
    selectedAssigneeIDs,
    selectedLabelIDs,
    statuses,
    members,
    labels,
    onShowClosedChange,
    onIncludeBacklogChange,
    onToggleStatus,
    onTogglePriority,
    onToggleAssignee,
    onToggleLabel,
  }: FilterPanelProps = $props();

  const orderedStatuses = $derived([...statuses].sort((a, b) => STATUS_CATEGORIES.indexOf(a.category) - STATUS_CATEGORIES.indexOf(b.category) || a.position - b.position));
</script>

<div class="filter-panel">
  <div class="options">
    <Toggle checked={showClosed} onChange={onShowClosedChange} label="Show closed" size="sm" />
    <Toggle checked={includeBacklog} onChange={onIncludeBacklogChange} label="Include backlog" size="sm" />
  </div>

  <div class="groups">
    <section>
      <h3>Status</h3>
      <ul>
        {#each orderedStatuses as status (status.id)}
          <li>
            <Checkbox checked={selectedStatusIDs.includes(status.id)} onchange={() => onToggleStatus(status.id)}>
              <StatusChip name={status.name} category={status.category} />
            </Checkbox>
          </li>
        {/each}
      </ul>
    </section>

    <section>
      <h3>Priority</h3>
      <ul>
        {#each PRIORITIES as priority (priority)}
          <li>
            <Checkbox checked={selectedPriorities.includes(priority)} onchange={() => onTogglePriority(priority)}>
              <PriorityChip {priority} variant="chip" />
            </Checkbox>
          </li>
        {/each}
      </ul>
    </section>

    <section>
      <h3>Assignee</h3>
      <ul>
        {#each members as member (member.userID)}
          <li>
            <Checkbox checked={selectedAssigneeIDs.includes(member.userID)} onchange={() => onToggleAssignee(member.userID)}>
              <span class="person">
                <UserAvatar name={member.user.name} avatarURL={member.user.avatarURL} size="sm" />
                <span class="person-name">{member.user.name}</span>
              </span>
            </Checkbox>
          </li>
        {/each}
      </ul>
    </section>

    {#if labels.length > 0}
      <section>
        <h3>Labels</h3>
        <ul>
          {#each labels as label (label.id)}
            <li>
              <Checkbox checked={selectedLabelIDs.includes(label.id)} onchange={() => onToggleLabel(label.id)}>
                <LabelChip name={label.name} colour={label.colour} />
              </Checkbox>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  </div>
</div>

<style>
  .filter-panel {
    display: flex;
    flex-direction: column;
    gap: 0.75em;
    padding: 0.5em;
  }

  .options {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5em 1.25em;
    padding-bottom: 0.75em;
    border-bottom: var(--border);
  }

  .groups {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1em 1.5em;
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 0.35em;
    min-width: 0;
  }

  h3 {
    font-size: 0.7em;
    font-weight: 600;
    color: var(--colour-muted);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15em;
  }

  .person {
    display: inline-flex;
    align-items: center;
    gap: 0.45em;
  }

  .person-name {
    overflow-wrap: anywhere;
  }

  @media (max-width: 720px) {
    .groups {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
