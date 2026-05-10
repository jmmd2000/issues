<script lang="ts">
  import { resolve } from "$app/paths";
  import type { PageProps } from "./$types";
  import { goto, invalidateAll } from "$app/navigation";
  import { client } from "$lib/api/client";
  import { ChevronRight, Copy, MoreHorizontal, Pencil, Trash2, X } from "@lucide/svelte";
  import type { Priority } from "@issues/api";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Modal from "$lib/components/ui/Modal.svelte";
  import Popover from "$lib/components/ui/Popover.svelte";
  import VisibilityToggle from "$lib/components/ui/VisibilityToggle.svelte";
  import TicketChildren from "$lib/components/tickets/TicketChildren.svelte";
  import TicketModal from "$lib/components/tickets/TicketModal.svelte";
  import TicketDescription from "$lib/components/tickets/TicketDescription.svelte";
  import TicketTitle from "$lib/components/tickets/TicketTitle.svelte";
  import AssigneePicker from "$lib/components/tickets/AssigneePicker.svelte";
  import LabelsPicker from "$lib/components/tickets/LabelsPicker.svelte";
  import PriorityPicker from "$lib/components/tickets/PriorityPicker.svelte";
  import StatusPicker from "$lib/components/tickets/StatusPicker.svelte";
  import TicketSearchModal from "$lib/components/tickets/TicketSearchModal.svelte";
  import TicketHistory from "$lib/components/tickets/TicketHistory.svelte";
  import TicketLinks from "$lib/components/tickets/TicketLinks.svelte";
  import TicketAttachments from "$lib/components/tickets/TicketAttachments.svelte";
  import { pushToast } from "$lib/stores/toast.svelte";

  let { data }: PageProps = $props();
  let ticket = $derived(data.ticket);
  let project = $derived(data.project);
  let comments = $derived(data.comments);
  let activity = $derived(data.activity);
  let links = $derived(data.links);
  let attachments = $derived(data.attachments);
  const attachmentContext = $derived({ projectKey: project.key, ticketNumber: ticket.number });

  let savingTitle = $state(false);
  let savingDescription = $state(false);
  let assigneeID = $derived<string | undefined>(ticket.assignee?.id ?? undefined);
  let statusID = $derived(ticket.status.id);
  let priority = $derived<Priority>(ticket.priority);
  let labelIDs = $derived(ticket.labels.map((label) => label.id));
  let visibility = $derived<"public" | "private">(ticket.visibility);
  let savingAssignee = $state(false);
  let savingStatus = $state(false);
  let savingPriority = $state(false);
  let savingLabels = $state(false);
  let savingVisibility = $state(false);
  let savingParent = $state(false);
  let parentSearchOpen = $state(false);
  let actionsOpen = $state(false);
  let deleteConfirmOpen = $state(false);
  let deleting = $state(false);
  let cloneOpen = $state(false);

  async function deleteTicket() {
    if (deleting) return;
    deleting = true;
    const projectKey = project.key;
    const ticketKey = `${projectKey}-${ticket.number}`;
    const ticketNumber = ticket.number;
    try {
      const res = await client.api.projects[":key"].tickets[":num"].$delete({
        param: { key: projectKey, num: String(ticketNumber) },
      });

      if (!res.ok) {
        pushToast({ message: `Failed to delete ${ticketKey}.`, kind: "error" });
        return;
      }

      deleteConfirmOpen = false;
      actionsOpen = false;
      await goto(resolve("/projects/[key]", { key: projectKey }));
      pushToast({
        message: `Deleted ${ticketKey}.`,
        action: {
          label: "Undo",
          run: async () => {
            const restoreRes = await client.api.projects[":key"].tickets[":num"].restore.$post({
              param: { key: projectKey, num: String(ticketNumber) },
            });
            if (!restoreRes.ok) {
              pushToast({ message: `Failed to restore ${ticketKey}.`, kind: "error" });
              return;
            }
            await goto(resolve("/projects/[key]/tickets/[num]", { key: projectKey, num: String(ticketNumber) }));
          },
        },
      });
    } finally {
      deleting = false;
    }
  }

  const dateFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  function formatDate(value: string | null) {
    if (!value) return "Not set";

    return dateFormatter.format(new Date(value));
  }

  async function saveTitle(title: string) {
    if (savingTitle) return false;

    savingTitle = true;
    try {
      const res = await client.api.projects[":key"].tickets[":num"].$patch({
        param: { key: project.key, num: String(ticket.number) },
        json: { title },
      });

      if (!res.ok) return false;

      await invalidateAll();
      return true;
    } finally {
      savingTitle = false;
    }
  }

  async function saveDescription(description: string) {
    if (savingDescription) return false;

    savingDescription = true;
    try {
      const res = await client.api.projects[":key"].tickets[":num"].$patch({
        param: { key: project.key, num: String(ticket.number) },
        json: { description },
      });

      if (!res.ok) return false;

      await invalidateAll();
      return true;
    } finally {
      savingDescription = false;
    }
  }

  async function saveAssignee(nextAssigneeID: string | undefined, previousAssigneeID: string | undefined) {
    if (savingAssignee) return;

    savingAssignee = true;
    try {
      const res = await client.api.projects[":key"].tickets[":num"].$patch({
        param: { key: project.key, num: String(ticket.number) },
        json: { assigneeID: nextAssigneeID ?? null },
      });

      if (!res.ok) {
        assigneeID = previousAssigneeID;
        return;
      }

      await invalidateAll();
    } catch {
      assigneeID = previousAssigneeID;
    } finally {
      savingAssignee = false;
    }
  }

  async function saveStatus(nextStatusID: string, previousStatusID: string) {
    if (savingStatus) return;

    savingStatus = true;
    try {
      const res = await client.api.projects[":key"].tickets[":num"].$patch({
        param: { key: project.key, num: String(ticket.number) },
        json: { statusID: nextStatusID },
      });

      if (!res.ok) {
        statusID = previousStatusID;
        return;
      }

      await invalidateAll();
    } catch {
      statusID = previousStatusID;
    } finally {
      savingStatus = false;
    }
  }

  async function savePriority(nextPriority: Priority, previousPriority: Priority) {
    if (savingPriority) return;

    savingPriority = true;
    try {
      const res = await client.api.projects[":key"].tickets[":num"].$patch({
        param: { key: project.key, num: String(ticket.number) },
        json: { priority: nextPriority },
      });

      if (!res.ok) {
        priority = previousPriority;
        return;
      }

      await invalidateAll();
    } catch {
      priority = previousPriority;
    } finally {
      savingPriority = false;
    }
  }

  async function saveParent(nextParentTicketID: string | null) {
    if (savingParent) return;

    savingParent = true;
    try {
      const res = await client.api.projects[":key"].tickets[":num"].$patch({
        param: { key: project.key, num: String(ticket.number) },
        json: { parentTicketID: nextParentTicketID },
      });

      if (!res.ok) return;
      await invalidateAll();
    } finally {
      savingParent = false;
    }
  }

  async function saveLabels(nextLabelIDs: string[], previousLabelIDs: string[]) {
    if (savingLabels) return;

    savingLabels = true;
    try {
      const res = await client.api.projects[":key"].tickets[":num"].$patch({
        param: { key: project.key, num: String(ticket.number) },
        json: { labelIDs: nextLabelIDs },
      });

      if (!res.ok) {
        labelIDs = previousLabelIDs;
        return;
      }

      await invalidateAll();
    } catch {
      labelIDs = previousLabelIDs;
    } finally {
      savingLabels = false;
    }
  }

  async function saveVisibility(next: "public" | "private", previous: "public" | "private") {
    if (savingVisibility) return;
    savingVisibility = true;
    try {
      const res = await client.api.projects[":key"].tickets[":num"].$patch({
        param: { key: project.key, num: String(ticket.number) },
        json: { visibility: next },
      });
      if (!res.ok) {
        visibility = previous;
        return;
      }
      await invalidateAll();
    } catch {
      visibility = previous;
    } finally {
      savingVisibility = false;
    }
  }
</script>

<svelte:head>
  <title>{project.key}-{ticket.number} {ticket.title}</title>
</svelte:head>

<section class="ticket-page">
  <div class="ticket-header">
    <div class="ticket-info">
      <div class="ticket-topline">
        <a href={resolve("/projects/[key]", { key: project.key })}>{project.name}</a>
        <ChevronRight size={15} strokeWidth={3} color="var(--colour-muted)" />
        <p>{project.key}-{ticket.number}</p>
      </div>

      <div class="ticket-headline">
        <TicketTitle title={ticket.title} saving={savingTitle} onsave={saveTitle} />
      </div>
    </div>

    <div class="ticket-actions">
      <Popover bind:open={actionsOpen} menuRole="menu" menuLabel="Ticket actions">
        {#snippet trigger({ toggle, open: isOpen })}
          <Button size="sm" onclick={toggle} aria-haspopup="menu" aria-expanded={isOpen} aria-label="Ticket actions">
            <MoreHorizontal size={16} strokeWidth={2.5} />
          </Button>
        {/snippet}
        {#snippet menu()}
          <button
            type="button"
            class="action-item"
            role="menuitem"
            onclick={() => {
              actionsOpen = false;
              cloneOpen = true;
            }}
          >
            <Copy size={14} strokeWidth={2} /> Clone ticket
          </button>
          <div class="action-separator" role="separator"></div>
          <button
            type="button"
            class="action-item action-item--danger"
            role="menuitem"
            onclick={() => {
              actionsOpen = false;
              deleteConfirmOpen = true;
            }}
          >
            <Trash2 size={14} strokeWidth={2} /> Delete ticket
          </button>
        {/snippet}
      </Popover>
    </div>
  </div>

  <div class="ticket-content">
    <main class="ticket-main">
      <TicketDescription description={ticket.description} saving={savingDescription} onsave={saveDescription} {attachmentContext} />
      <TicketChildren
        children={ticket.children}
        projectKey={project.key}
        parentTicketID={ticket.id}
        parentTicketNumber={ticket.number}
        parentTicketTitle={ticket.title}
        statuses={project.statuses}
        labels={project.labels}
        members={project.members}
        currentUserID={data.user.id}
        onmutated={() => invalidateAll()}
      />
      <TicketAttachments {attachments} projectKey={project.key} ticketNumber={ticket.number} onmutated={() => invalidateAll()} />
      <TicketLinks {links} projectKey={project.key} ticketNumber={ticket.number} onmutated={() => invalidateAll()} />
      <TicketHistory
        {comments}
        {activity}
        statuses={project.statuses}
        labels={project.labels}
        members={project.members}
        projectKey={project.key}
        ticketNumber={ticket.number}
        currentUserID={data.user.id}
        onmutated={() => invalidateAll()}
      />
    </main>

    <aside class="ticket-sidebar" aria-label="Ticket metadata">
      <section class="sidebar-card card">
        <h2>People</h2>

        <dl class="property-list">
          <div class="property-row">
            <dt>Assignee</dt>
            <dd>
              <AssigneePicker
                members={data.project.members}
                currentUserID={data.user.id}
                bind:value={assigneeID}
                disabled={savingAssignee}
                loading={savingAssignee}
                size="sm"
                onselect={(nextAssigneeID, previousAssigneeID) => void saveAssignee(nextAssigneeID, previousAssigneeID)}
              />
            </dd>
          </div>

          <div class="property-row">
            <dt>Reporter</dt>
            <dd>
              <span class="person-value">
                <UserAvatar name={ticket.reporter.name} avatarURL={ticket.reporter.avatarURL} size="sm" />
                <span>{ticket.reporter.name}</span>
              </span>
            </dd>
          </div>
        </dl>
      </section>

      <section class="sidebar-card card">
        <h2>Properties</h2>

        <dl class="property-list">
          <div class="property-row">
            <dt>Status</dt>
            <dd>
              <StatusPicker
                statuses={project.statuses}
                bind:value={statusID}
                disabled={savingStatus}
                loading={savingStatus}
                size="sm"
                onselect={(nextStatusID, previousStatusID) => void saveStatus(nextStatusID, previousStatusID)}
              />
            </dd>
          </div>

          <div class="property-row">
            <dt>Priority</dt>
            <dd>
              <PriorityPicker
                bind:value={priority}
                disabled={savingPriority}
                loading={savingPriority}
                size="sm"
                onselect={(nextPriority, previousPriority) => void savePriority(nextPriority, previousPriority)}
              />
            </dd>
          </div>

          <div class="property-row">
            <dt>Parent</dt>
            <dd>
              {#if ticket.parent}
                <span class="parent-cluster">
                  <a class="parent-pill" href={resolve("/projects/[key]/tickets/[num]", { key: project.key, num: String(ticket.parent.number) })} title={ticket.parent.title}>{project.key}-{ticket.parent.number}</a>
                  <button type="button" class="parent-icon-btn" onclick={() => (parentSearchOpen = true)} disabled={savingParent} aria-label="Change parent" title="Change parent">
                    <Pencil size={12} strokeWidth={2.5} />
                  </button>
                  <button type="button" class="parent-icon-btn destructive" onclick={() => void saveParent(null)} disabled={savingParent} aria-label="Remove parent" title="Remove parent">
                    <X size={12} strokeWidth={2.5} />
                  </button>
                </span>
              {:else}
                <button type="button" class="set-parent" onclick={() => (parentSearchOpen = true)} disabled={savingParent}>+ Set parent</button>
              {/if}
            </dd>
          </div>

          <div class="property-row">
            <dt>Labels</dt>
            <dd>
              <LabelsPicker
                labels={project.labels}
                bind:value={labelIDs}
                disabled={savingLabels}
                loading={savingLabels}
                size="sm"
                oncommit={(nextLabelIDs, previousLabelIDs) => void saveLabels(nextLabelIDs, previousLabelIDs)}
              />
            </dd>
          </div>

          <div class="property-row">
            <dt>Visibility</dt>
            <dd>
              <VisibilityToggle bind:value={visibility} size="sm" disabled={savingVisibility} onchange={(next, previous) => void saveVisibility(next, previous)} />
            </dd>
          </div>
        </dl>
      </section>

      <section class="sidebar-card card">
        <h2>Dates</h2>

        <dl class="property-list">
          <div class="property-row">
            <dt>Created</dt>
            <dd>{formatDate(ticket.createdAt)}</dd>
          </div>

          <div class="property-row">
            <dt>Updated</dt>
            <dd>{formatDate(ticket.updatedAt)}</dd>
          </div>

          <div class="property-row">
            <dt>Completed</dt>
            <dd>{formatDate(ticket.completedAt)}</dd>
          </div>
        </dl>
      </section>
    </aside>
  </div>
</section>

<TicketSearchModal
  open={parentSearchOpen}
  title="Set parent ticket"
  projectKey={project.key}
  statuses={project.statuses}
  members={project.members}
  excludeTicketNumbers={[ticket.number]}
  onpicked={(picked) => {
    parentSearchOpen = false;
    void saveParent(picked.id);
  }}
  onclose={() => (parentSearchOpen = false)}
/>

<Modal open={deleteConfirmOpen} title="Delete {project.key}-{ticket.number}?" onclose={() => (deleteConfirmOpen = false)} maxWidth="28rem">
  <p class="confirm-body">
    Soft delete <strong>{project.key}-{ticket.number}</strong>. The ticket can be restored from project settings -> Trash.
  </p>
  {#snippet footer()}
    <Button type="button" variant="secondary" onclick={() => (deleteConfirmOpen = false)} disabled={deleting}>Cancel</Button>
    <Button type="button" variant="danger" onclick={() => void deleteTicket()} disabled={deleting}>
      {deleting ? "Deleting..." : "Delete ticket"}
    </Button>
  {/snippet}
</Modal>

<TicketModal
  open={cloneOpen}
  mode="clone"
  source={ticket}
  projectKey={project.key}
  statuses={project.statuses}
  labels={project.labels}
  members={project.members}
  currentUserID={data.user.id}
  onclose={() => (cloneOpen = false)}
/>

<style>
  .ticket-page {
    padding-top: 0.5em;
    max-width: 1200px;
    margin: auto;
  }

  .ticket-header {
    display: flex;
    justify-content: space-between;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .ticket-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .ticket-actions {
    display: flex;
    align-items: flex-start;
  }

  :global(.action-item) {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.45rem 0.6rem;
    border: 0;
    background: transparent;
    color: var(--colour-text);
    font: inherit;
    font-size: 0.85rem;
    border-radius: var(--border-radius-inner);
    text-align: left;
    cursor: pointer;
  }

  :global(.action-item:hover),
  :global(.action-item:focus-visible) {
    background: var(--colour-bg-hover);
    outline: none;
  }

  :global(.action-item--danger) {
    color: var(--colour-error);
  }

  :global(.action-item--danger:hover),
  :global(.action-item--danger:focus-visible) {
    background: var(--colour-error-bg);
  }

  :global(.action-separator) {
    height: 1px;
    background: var(--colour-border);
    margin: 0.2rem 0;
  }

  .confirm-body {
    margin: 0;
    color: var(--colour-text);
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .ticket-topline {
    display: flex;
    align-items: center;
    gap: 0.25em;
    margin-bottom: 0.4em;
    font-size: 1em;

    & a {
      text-decoration: none;
      color: var(--accent-base);
      font-weight: 600;
    }

    & a:hover {
      color: var(--accent-tint-300);
      text-decoration: underline;
    }

    & p {
      font-family: var(--font-mono);
      font-weight: 600;
      color: var(--accent-base);
      font-size: 0.85em;
      letter-spacing: 0.01em;
    }
  }

  .ticket-content {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(17rem, 22rem);
    gap: 1.25rem;
    align-items: start;
  }

  .ticket-main {
    display: grid;
    gap: 1rem;
    min-width: 0;
  }

  .ticket-sidebar {
    display: grid;
    gap: 0.75rem;
    min-width: 0;
  }

  .sidebar-card {
    padding: 0.85rem;
  }

  .sidebar-card h2 {
    color: var(--colour-text);
    font-size: 0.8rem;
    font-weight: 800;
    margin-bottom: 0.7rem;
  }

  .property-list {
    display: grid;
    gap: 0.65rem;
  }

  .property-row {
    display: grid;
    grid-template-columns: minmax(5.2rem, 0.55fr) minmax(0, 1fr);
    gap: 0.75rem;
    align-items: center;
  }

  .property-list dt {
    color: var(--colour-muted);
    font-size: 0.8rem;
    font-weight: 700;
    line-height: 1.35;
  }

  .property-list dd {
    display: flex;
    align-items: center;
    min-width: 0;
    color: var(--colour-text);
    font-size: 0.8rem;
    font-weight: 600;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .person-value {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
    white-space: nowrap;
  }

  /* Sized to match the picker triggers' size="sm" rule (StatusPicker,
     PriorityPicker, LabelsPicker, AssigneePicker): padding, font-size, and
     a negative margin-left that pulls the chip's visible left edge into
     line with where the dt text would sit. Without that margin the chips
     sit 0.4rem to the right of the column. */
  .parent-cluster {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    margin-left: -0.4rem;
    min-width: 0;
    max-width: 100%;
  }

  .parent-pill,
  .parent-icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 1.65rem;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg);
    font-size: 0.7rem;
    line-height: 1;
    box-sizing: border-box;
  }

  .parent-pill {
    padding: 0 0.45rem;
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--accent-base);
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &:hover,
    &:focus-visible {
      background: var(--colour-bg-hover);
      outline: none;
    }
  }

  .parent-icon-btn {
    width: 1.65rem;
    padding: 0;
    color: var(--colour-muted);
    cursor: pointer;
    flex: 0 0 auto;

    &:hover:not(:disabled),
    &:focus-visible {
      color: var(--colour-text);
      background: var(--colour-bg-hover);
      outline: none;
    }

    &.destructive:hover:not(:disabled),
    &.destructive:focus-visible {
      color: var(--colour-error);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .set-parent {
    display: inline-flex;
    align-items: center;
    margin-left: -0.4rem;
    padding: 0.25rem 0.45rem;
    border: 1px dashed var(--colour-border);
    border-radius: var(--border-radius-inner);
    background: transparent;
    color: var(--colour-muted);
    font: inherit;
    font-size: 0.7rem;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;

    &:hover:not(:disabled),
    &:focus-visible {
      color: var(--accent-base);
      border-color: var(--accent-tint-600);
      background: var(--accent-tint-900);
      outline: none;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  @media (max-width: 900px) {
    .ticket-content {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .ticket-header {
      flex-direction: column;
      gap: 1em;
    }

    .property-row {
      /* grid-template-columns: 1fr; */
      gap: 0.25rem;
    }
  }
</style>
