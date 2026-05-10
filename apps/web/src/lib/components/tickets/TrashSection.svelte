<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { page as pageStore } from "$app/state";
  import type { ProjectMember, Status, Ticket } from "@issues/api";
  import { client } from "$lib/api/client";
  import Button from "$lib/components/ui/Button.svelte";
  import Modal from "$lib/components/ui/Modal.svelte";
  import TicketList, { type TicketListColumnID, type TicketListSortDirection } from "./TicketList.svelte";
  import { pushToast } from "$lib/stores/toast.svelte";

  interface TrashSectionProps {
    projectKey: string;
    statuses: Status[];
    members: ProjectMember[];
    tickets: Ticket[];
    page: number;
    hasNextPage: boolean;
    sortColumn: TicketListColumnID;
    sortDirection: TicketListSortDirection;
  }

  let { projectKey, statuses, members, tickets, page, hasNextPage, sortColumn, sortDirection }: TrashSectionProps = $props();

  // Settings page is constrained to ~800px wide, so trim Status + Priority to
  // keep the row legible without horizontal scroll. Updated == delete time
  // since the soft-delete bumps `updated_at`.
  const visibleColumnIDs = new Set<TicketListColumnID>(["key", "title", "assignee", "updatedAt"]);

  function pushParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(pageStore.url.searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    const search = params.toString();
    void goto(`${pageStore.url.pathname}${search ? `?${search}` : ""}`, { keepFocus: true, noScroll: true });
  }

  function changePage(next: number) {
    pushParams({ trashPage: next <= 1 ? null : String(next) });
  }

  function changeSort(columnID: TicketListColumnID, direction: TicketListSortDirection) {
    pushParams({
      trashSortBy: columnID === "updatedAt" ? null : columnID,
      trashSortDirection: direction === "desc" ? null : direction,
      trashPage: null,
    });
  }

  let restoringNumber = $state<number | null>(null);
  let confirmTarget = $state<Ticket | null>(null);
  let purging = $state(false);

  async function restore(ticket: Ticket) {
    if (restoringNumber !== null) return;
    restoringNumber = ticket.number;
    try {
      const res = await client.api.projects[":key"].tickets[":num"].restore.$post({
        param: { key: projectKey, num: String(ticket.number) },
      });
      if (!res.ok) {
        pushToast({ message: `Failed to restore ${projectKey}-${ticket.number}.`, kind: "error" });
        return;
      }
      pushToast({ message: `Restored ${projectKey}-${ticket.number}.`, kind: "success" });
      await invalidateAll();
    } finally {
      restoringNumber = null;
    }
  }

  async function purge() {
    if (!confirmTarget || purging) return;
    purging = true;
    const ticket = confirmTarget;
    try {
      const res = await client.api.projects[":key"].tickets[":num"].permanent.$delete({
        param: { key: projectKey, num: String(ticket.number) },
      });
      if (!res.ok) {
        pushToast({ message: `Failed to permanently delete ${projectKey}-${ticket.number}.`, kind: "error" });
        return;
      }
      confirmTarget = null;
      pushToast({ message: `Permanently deleted ${projectKey}-${ticket.number}.` });
      await invalidateAll();
    } finally {
      purging = false;
    }
  }
</script>

<div class="trash-section">
  <p class="hint">Soft-deleted tickets stay restorable until you delete them forever. Restoring brings them back to their previous status.</p>

  {#if tickets.length === 0}
    <p class="empty">Trash is empty.</p>
  {:else}
    <TicketList
      {projectKey}
      {statuses}
      {members}
      {tickets}
      {visibleColumnIDs}
      {sortColumn}
      {sortDirection}
      {page}
      {hasNextPage}
      readonly
      onSortChange={changeSort}
      onPageChange={changePage}
    >
      {#snippet rowActions(ticket: Ticket)}
        <div class="row-actions">
          <Button type="button" size="sm" variant="secondary" disabled={restoringNumber === ticket.number} onclick={() => void restore(ticket)}>
            {restoringNumber === ticket.number ? "Restoring..." : "Restore"}
          </Button>
          <Button type="button" size="sm" variant="danger" onclick={() => (confirmTarget = ticket)}>Delete forever</Button>
        </div>
      {/snippet}
    </TicketList>
  {/if}
</div>

<Modal open={confirmTarget !== null} title="Delete forever?" onclose={() => (confirmTarget = null)} maxWidth="28rem">
  {#if confirmTarget}
    <p class="confirm-body">
      Permanently delete <strong>{projectKey}-{confirmTarget.number}</strong>. This cannot be undone -- comments, activity, links, and attachment metadata will all be removed.
    </p>
  {/if}
  {#snippet footer()}
    <Button type="button" variant="secondary" onclick={() => (confirmTarget = null)} disabled={purging}>Cancel</Button>
    <Button type="button" variant="danger" disabled={purging} onclick={() => void purge()}>
      {purging ? "Deleting..." : "Delete forever"}
    </Button>
  {/snippet}
</Modal>

<style>
  .trash-section {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .hint {
    margin: 0;
    color: var(--colour-text-secondary);
    font-size: 0.85em;
    line-height: 1.5;
  }

  .empty {
    margin: 0;
    color: var(--colour-muted);
    font-size: 0.9em;
    font-style: italic;
    padding: 1.5em 0;
    text-align: center;
    border: 1.5px dashed var(--colour-border);
    border-radius: var(--border-radius-outer);
  }

  .row-actions {
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
  }

  .confirm-body {
    margin: 0;
    color: var(--colour-text);
    font-size: 0.9rem;
    line-height: 1.5;
  }
</style>
