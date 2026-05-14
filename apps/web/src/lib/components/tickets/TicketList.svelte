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

  export const LIST_COLUMN_IDS = LIST_COLUMNS.map((column) => column.id) as readonly TicketListColumnID[] as readonly [TicketListColumnID, ...TicketListColumnID[]];
</script>

<script lang="ts">
  import { resolve } from "$app/paths";
  import type { Snippet } from "svelte";
  import type { ProjectMember, Status, Ticket } from "@issues/api";
  import { ArrowDown, ArrowUp } from "@lucide/svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import PriorityChip from "./PriorityChip.svelte";
  import StatusChip from "./StatusChip.svelte";

  let {
    projectKey,
    statuses,
    members,
    tickets,
    visibleColumnIDs = new Set<TicketListColumnID>(LIST_COLUMNS.map((column) => column.id)),
    sortColumn,
    sortDirection,
    page,
    perPage,
    total,
    readonly = false,
    rowActions,
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
    perPage: number;
    total: number;
    /** When true, key + title cells render as plain text rather than links. Used by the trash view since soft-deleted tickets 404 on the detail page. */
    readonly?: boolean;
    /** Optional trailing cell renderer for per-row buttons (Restore, Delete forever, etc). */
    rowActions?: Snippet<[Ticket]>;
    /** Called with (null, null) when the user clicks past desc to clear the sort and fall back to the page default. */
    onSortChange: (columnID: TicketListColumnID | null, direction: TicketListSortDirection | null) => void;
    onPageChange: (page: number) => void;
  } = $props();

  const dateFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  });

  const visibleColumns = $derived(LIST_COLUMNS.filter((column) => visibleColumnIDs.has(column.id)));
  const statusByID = $derived(new Map(statuses.map((status) => [status.id, status])));
  const memberByID = $derived(new Map(members.map((member) => [member.userID, member])));

  const totalPages = $derived(total === 0 ? 0 : Math.ceil(total / perPage));
  const rangeStart = $derived(total === 0 ? 0 : (page - 1) * perPage + 1);
  const rangeEnd = $derived(Math.min(page * perPage, total));
  const hasPrev = $derived(page > 1);
  const hasNext = $derived(page < totalPages);

  function formatDate(value: string) {
    return dateFormatter.format(new Date(value));
  }

  function defaultDirectionFor(columnID: TicketListColumnID): TicketListSortDirection {
    return columnID === "updatedAt" || columnID === "priority" ? "desc" : "asc";
  }

  // Three-state cycle on repeat clicks: first direction, opposite direction, then cleared.
  function setSort(columnID: TicketListColumnID) {
    const first = defaultDirectionFor(columnID);
    if (sortColumn !== columnID) {
      onSortChange(columnID, first);
      return;
    }
    if (sortDirection === first) {
      onSortChange(columnID, first === "asc" ? "desc" : "asc");
      return;
    }
    onSortChange(null, null);
  }
</script>

<div class="ticket-list">
  <div class="table-wrap card">
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
          {#if rowActions}
            <th class="actions-col" aria-label="Actions"></th>
          {/if}
        </tr>
      </thead>
      <tbody>
        {#each tickets as ticket (ticket.id)}
          {@const ticketHref = resolve("/projects/[key]/tickets/[num]", { key: projectKey, num: String(ticket.number) })}
          <tr>
            {#each visibleColumns as column (column.id)}
              {#if column.id === "key"}
                <td class="key">{#if readonly}{projectKey}-{ticket.number}{:else}<a href={ticketHref}>{projectKey}-{ticket.number}</a>{/if}</td>
              {:else if column.id === "title"}
                <td class="title">{#if readonly}{ticket.title}{:else}<a href={ticketHref}>{ticket.title}</a>{/if}</td>
              {:else if column.id === "status"}
                {@const status = statusByID.get(ticket.statusID)}
                <td>
                  {#if status}
                    <StatusChip name={status.name} category={status.category} />
                  {:else}
                    <StatusChip name="Unknown" category="backlog" />
                  {/if}
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
            {#if rowActions}
              <td class="actions-cell">{@render rowActions(ticket)}</td>
            {/if}
          </tr>
        {:else}
          <tr>
            <td colspan={visibleColumns.length + (rowActions ? 1 : 0)} class="empty">No tickets match this view.</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  {#if total > 0}
    <div class="pager">
      <span class="range">Showing <strong>{rangeStart}</strong>–<strong>{rangeEnd}</strong> of <strong>{total}</strong></span>
      <div class="controls">
        <Button type="button" variant="secondary" size="sm" disabled={!hasPrev} onclick={() => onPageChange(page - 1)}>Previous</Button>
        <span class="page-of">Page {page} of {totalPages}</span>
        <Button type="button" variant="secondary" size="sm" disabled={!hasNext} onclick={() => onPageChange(page + 1)}>Next</Button>
      </div>
    </div>
  {/if}
</div>

<style>
  .ticket-list {
    display: grid;
    gap: 0.8em;
  }

  .table-wrap {
    overflow-x: auto;
    padding: 0;
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
    font-size: 0.8em;
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
    font-size: 0.7em;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-align: left;
    text-transform: uppercase;
    cursor: pointer;

    &:hover,
    &[data-active="true"] {
      color: var(--colour-text);
      background: var(--colour-bg-hover);
    }
  }

  .sort-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 0.85rem;
    color: var(--accent-base);
  }

  tbody tr {
    &:last-child td {
      border-bottom: none;
    }

    &:hover {
      background: var(--colour-bg-hover);
    }
  }

  .key {
    font-family: var(--font-mono);
    white-space: nowrap;

    & a {
      color: var(--accent-base);
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  .title {
    color: var(--colour-text);
    font-weight: 600;
    min-width: 18em;

    & a {
      color: inherit;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
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

  .actions-col {
    width: 1px;
    white-space: nowrap;
  }

  .actions-cell {
    text-align: right;
    white-space: nowrap;
    padding-right: 0.6em;
  }

  .pager {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1em;
    color: var(--colour-text-secondary);
    font-size: 0.8em;

    .range strong {
      color: var(--colour-text);
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }

    .controls {
      display: inline-flex;
      align-items: center;
      gap: 0.65em;
    }

    .page-of {
      font-variant-numeric: tabular-nums;
    }
  }

  @media (max-width: 640px) {
    .pager {
      flex-direction: column;
      align-items: stretch;
      gap: 0.5em;

      .controls {
        justify-content: space-between;
      }
    }
  }
</style>
