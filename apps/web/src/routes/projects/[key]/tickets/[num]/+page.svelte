<script lang="ts">
  import { resolve } from "$app/paths";
  import type { PageProps } from "./$types";
  import { invalidateAll } from "$app/navigation";
  import { client } from "$lib/api/client";
  import { ChevronRight } from "@lucide/svelte";
  import type { Priority } from "@issues/api";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import TicketDescription from "$lib/components/tickets/TicketDescription.svelte";
  import TicketTitle from "$lib/components/tickets/TicketTitle.svelte";
  import AssigneePicker from "$lib/components/tickets/AssigneePicker.svelte";
  import LabelsPicker from "$lib/components/tickets/LabelsPicker.svelte";
  import PriorityPicker from "$lib/components/tickets/PriorityPicker.svelte";
  import StatusPicker from "$lib/components/tickets/StatusPicker.svelte";
  import TicketHistory from "$lib/components/tickets/TicketHistory.svelte";
  import TicketLinks from "$lib/components/tickets/TicketLinks.svelte";
  import TicketAttachments from "$lib/components/tickets/TicketAttachments.svelte";
  import { Eye, EyeOff } from "@lucide/svelte";

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

  async function toggleVisibility() {
    if (savingVisibility) return;
    const next = visibility === "public" ? "private" : "public";
    const previous = visibility;
    visibility = next;
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
  </div>

  <div class="ticket-content">
    <main class="ticket-main">
      <TicketDescription description={ticket.description} saving={savingDescription} onsave={saveDescription} {attachmentContext} />
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
                <a class="ticket-link" href={resolve("/projects/[key]/tickets/[num]", { key: project.key, num: String(ticket.parent.number) })}>{project.key}-{ticket.parent.number}</a>
              {:else}
                <span class="muted-value">None</span>
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
              <button
                type="button"
                class="visibility-pill"
                class:private={visibility === "private"}
                onclick={() => void toggleVisibility()}
                disabled={savingVisibility}
                aria-pressed={visibility === "private"}
                title={visibility === "public" ? "Public — visible to anyone if the project is public" : "Private — members only"}
              >
                {#if visibility === "private"}
                  <EyeOff size={12} strokeWidth={2.5} /> Private
                {:else}
                  <Eye size={12} strokeWidth={2.5} /> Public
                {/if}
              </button>
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

  .muted-value {
    color: var(--colour-muted);
    font-weight: 500;
  }

  .visibility-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0.55rem;
    border: var(--border);
    border-radius: 999px;
    background: var(--colour-bg);
    color: var(--colour-text);
    font: inherit;
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
  }

  .visibility-pill:hover:not(:disabled) {
    background: var(--colour-bg-lighter);
  }

  .visibility-pill.private {
    color: var(--accent-shade-200);
    background: var(--accent-tint-800);
    border-color: var(--accent-tint-600);
  }

  .visibility-pill:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .ticket-link {
    color: var(--accent-base);
    font-family: var(--font-mono);
    font-size: 0.9em;
    text-decoration: none;
  }

  .ticket-link:hover {
    text-decoration: underline;
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
