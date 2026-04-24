<script lang="ts">
  import type { ProjectMember, Status, Ticket } from "@issues/api";
  import Button from "$lib/components/ui/Button.svelte";
  import PriorityChip from "./PriorityChip.svelte";

  let {
    projectKey,
    statuses,
    members,
    tickets,
    page,
    hasNextPage,
    onPageChange,
  }: {
    projectKey: string;
    statuses: Status[];
    members: ProjectMember[];
    tickets: Ticket[];
    page: number;
    hasNextPage: boolean;
    onPageChange: (page: number) => void;
  } = $props();

  const dateFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  });

  const statusByID = $derived(new Map(statuses.map((status) => [status.id, status.name])));
  const memberByID = $derived(new Map(members.map((member) => [member.userID, member.user.name])));

  function formatDate(value: string) {
    return dateFormatter.format(new Date(value));
  }
</script>

<div class="ticket-list">
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Key</th>
          <th>Title</th>
          <th>Status</th>
          <th>Priority</th>
          <th>Assignee</th>
          <th>Updated</th>
        </tr>
      </thead>
      <tbody>
        {#each tickets as ticket (ticket.id)}
          <tr>
            <td class="key">{projectKey}-{ticket.number}</td>
            <td class="title">{ticket.title}</td>
            <td>{statusByID.get(ticket.statusID) ?? "Unknown"}</td>
            <td><PriorityChip priority={ticket.priority} /></td>
            <td>{ticket.assigneeID ? (memberByID.get(ticket.assigneeID) ?? "Unknown") : "Unassigned"}</td>
            <td>{formatDate(ticket.updatedAt)}</td>
          </tr>
        {:else}
          <tr>
            <td colspan="6" class="empty">No tickets match this view.</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="pager">
    <Button type="button" variant="secondary" size="sm" disabled={page <= 1} onclick={() => onPageChange(page - 1)}>Previous</Button>
    <span>Page {page}</span>
    <Button type="button" variant="secondary" size="sm" disabled={!hasNextPage} onclick={() => onPageChange(page + 1)}>Next</Button>
  </div>
</div>

<style>
  .ticket-list {
    display: grid;
    gap: 0.8em;
  }

  .table-wrap {
    overflow-x: auto;
    border: var(--border);
    border-radius: var(--border-radius-outer);
    background: var(--colour-bg-lighter);
    box-shadow: var(--box-shadow);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 44em;
  }

  th,
  td {
    padding: 0.75em 0.8em;
    border-bottom: var(--border);
    text-align: left;
    font-size: 0.82em;
    vertical-align: middle;
  }

  th {
    color: var(--colour-muted);
    font-size: 0.72em;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    background: var(--colour-bg);
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  tbody tr:hover {
    background: var(--colour-bg-hover);
  }

  .key {
    font-family: var(--font-mono);
    color: var(--accent-base);
    white-space: nowrap;
  }

  .title {
    color: var(--colour-text);
    font-weight: 600;
    min-width: 18em;
  }

  .empty {
    text-align: center;
    color: var(--colour-muted);
    padding-block: 2em;
  }

  .pager {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.65em;
    color: var(--colour-text-secondary);
    font-size: 0.82em;
  }

  @media (max-width: 640px) {
    .pager {
      justify-content: space-between;
    }
  }
</style>
