<script module lang="ts">
  export const LIST_COLUMNS = [
    { id: "key", label: "Key" },
    { id: "title", label: "Title" },
    { id: "status", label: "Status" },
    { id: "priority", label: "Priority" },
    { id: "assignee", label: "Assignee" },
    { id: "updatedAt", label: "Updated" },
  ] as const;

  export type TicketListColumnID = (typeof LIST_COLUMNS)[number]["id"];
  export type TicketListSortDirection = "asc" | "desc";
</script>

<script lang="ts">
  import { resolve } from "$app/paths";
  import type { ProjectMember, Status, Ticket } from "@issues/api";
  import { ArrowDown, ArrowUp } from "@lucide/svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import PriorityChip from "./PriorityChip.svelte";

  let {
    projectKey,
    statuses,
    members,
    tickets,
    visibleColumnIDs = new Set<TicketListColumnID>(LIST_COLUMNS.map((column) => column.id)),
    sortColumn,
    sortDirection,
    page,
    hasNextPage,
    onSortChange,
    onPageChange,
  }: {
    projectKey: string;
    statuses: Status[];
    members: ProjectMember[];
    tickets: Ticket[];
    visibleColumnIDs?: Set<TicketListColumnID>;
    sortColumn: TicketListColumnID;
    sortDirection: TicketListSortDirection;
    page: number;
    hasNextPage: boolean;
    onSortChange: (columnID: TicketListColumnID, direction: TicketListSortDirection) => void;
    onPageChange: (page: number) => void;
  } = $props();

  const dateFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  });

  const statusColours: Record<Status["category"], string> = {
    backlog: "var(--colour-status-backlog)",
    active: "var(--colour-status-active)",
    done: "var(--colour-status-done)",
    cancelled: "var(--colour-status-cancelled)",
  };

  const visibleColumns = $derived(LIST_COLUMNS.filter((column) => visibleColumnIDs.has(column.id)));
  const statusByID = $derived(new Map(statuses.map((status) => [status.id, status])));
  const memberByID = $derived(new Map(members.map((member) => [member.userID, member])));

  function formatDate(value: string) {
    return dateFormatter.format(new Date(value));
  }

  function setSort(columnID: TicketListColumnID) {
    if (sortColumn === columnID) {
      onSortChange(columnID, sortDirection === "asc" ? "desc" : "asc");
      return;
    }

    onSortChange(columnID, columnID === "updatedAt" || columnID === "priority" ? "desc" : "asc");
  }
</script>

<div class="ticket-list">
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          {#each visibleColumns as column (column.id)}
            <th data-column={column.id} aria-sort={sortColumn === column.id ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
              <button type="button" class="sort-button" data-active={sortColumn === column.id} onclick={() => setSort(column.id)}>
                <span>{column.label}</span>
                <span class="sort-icon" aria-hidden="true">
                  {#if sortColumn === column.id}
                    {#if sortDirection === "asc"}
                      <ArrowUp size={12} strokeWidth={2.5} />
                    {:else}
                      <ArrowDown size={12} strokeWidth={2.5} />
                    {/if}
                  {/if}
                </span>
              </button>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each tickets as ticket (ticket.id)}
          {@const ticketHref = resolve("/projects/[key]/tickets/[num]", { key: projectKey, num: String(ticket.number) })}
          <tr>
            {#each visibleColumns as column (column.id)}
              {#if column.id === "key"}
                <td class="key"><a href={ticketHref}>{projectKey}-{ticket.number}</a></td>
              {:else if column.id === "title"}
                <td class="title"><a href={ticketHref}>{ticket.title}</a></td>
              {:else if column.id === "status"}
                {@const status = statusByID.get(ticket.statusID)}
                <td>
                  <span class="status-chip" style:--status-colour={status ? statusColours[status.category] : "var(--colour-status-backlog)"}>{status?.name ?? "Unknown"}</span>
                </td>
              {:else if column.id === "priority"}
                <td><PriorityChip priority={ticket.priority} variant="chip" /></td>
              {:else if column.id === "assignee"}
                {@const member = ticket.assigneeID ? (memberByID.get(ticket.assigneeID) ?? null) : null}
                <td>
                  {#if member}
                    <span class="assignee-cell">
                      <UserAvatar name={member.user.name} avatarURL={member.user.avatarURL} size="sm" />
                      <span>{member.user.name}</span>
                    </span>
                  {:else}
                    <span class="muted">Unassigned</span>
                  {/if}
                </td>
              {:else}
                <td class="date">{formatDate(ticket.updatedAt)}</td>
              {/if}
            {/each}
          </tr>
        {:else}
          <tr>
            <td colspan={visibleColumns.length} class="empty">No tickets match this view.</td>
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
    min-width: 50em;
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
    background: var(--colour-bg);
    padding: 0;
  }

  .sort-button {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    width: 100%;
    padding: 0.75em 0.8em;
    border: none;
    background: transparent;
    color: var(--colour-muted);
    font: inherit;
    font-size: 0.72em;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-align: left;
    text-transform: uppercase;
    cursor: pointer;
  }

  .sort-button:hover,
  .sort-button[data-active="true"] {
    color: var(--colour-text);
    background: var(--colour-bg-hover);
  }

  .sort-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 0.85rem;
    color: var(--accent-base);
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  tbody tr:hover {
    background: var(--colour-bg-hover);
  }

  .key {
    font-family: var(--font-mono);
    white-space: nowrap;
  }

  .key a,
  .title a {
    color: inherit;
    text-decoration: none;
  }

  .key a {
    color: var(--accent-base);
  }

  .key a:hover,
  .title a:hover {
    text-decoration: underline;
  }

  .title {
    color: var(--colour-text);
    font-weight: 600;
    min-width: 18em;
  }

  .status-chip {
    --status-colour: var(--colour-status-backlog);

    display: inline-flex;
    align-items: center;
    min-height: 1.4rem;
    padding: 0.2rem 0.45rem;
    border: 1px solid color-mix(in oklch, var(--status-colour) 35%, white 65%);
    border-radius: var(--border-radius-inner);
    background: color-mix(in oklch, var(--status-colour) 10%, white 90%);
    color: color-mix(in oklch, var(--status-colour) 80%, black 20%);
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
  }

  .assignee-cell {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
    color: var(--colour-text);
    font-weight: 600;
    white-space: nowrap;
  }

  .muted,
  .date {
    color: var(--colour-muted);
    white-space: nowrap;
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
