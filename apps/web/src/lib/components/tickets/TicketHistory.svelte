<script lang="ts">
  import type { Comment, Label, ProjectMember, Status, TicketActivity } from "@issues/api";
  import Tabs from "$lib/components/ui/Tabs.svelte";
  import CommentThread from "./CommentThread.svelte";
  import ActivityRow from "./ActivityRow.svelte";

  interface TicketHistoryProps {
    comments: Comment[];
    activity: TicketActivity[];
    statuses: Status[];
    labels: Label[];
    members: ProjectMember[];
    projectKey: string;
    ticketNumber: number;
    currentUserID: string;
    onmutated: () => void | Promise<void>;
  }

  let { comments, activity, statuses, labels, members, projectKey, ticketNumber, currentUserID, onmutated }: TicketHistoryProps = $props();

  const commentsByID = $derived(new Map(comments.map((comment) => [comment.id, comment])));

  function commentForRow(row: TicketActivity): Comment | undefined {
    if (row.action !== "comment_added") return undefined;
    const id = row.newValue?.id;
    return id ? commentsByID.get(id) : undefined;
  }

  const tabs = [
    { id: "comments", label: "Comments" },
    { id: "activity", label: "Activity" },
    { id: "all", label: "All" },
  ];
</script>

<Tabs {tabs} panels={{ comments: commentsPanel, activity: activityPanel, all: allPanel }} />

{#snippet commentsPanel()}
  <CommentThread {comments} {projectKey} {ticketNumber} {currentUserID} {onmutated} />
{/snippet}

{#snippet activityPanel()}
  <section class="activity-panel card" aria-label="Activity">
    {#if activity.length === 0}
      <p class="empty">No activity yet.</p>
    {:else}
      <div class="activity-list" role="list">
        {#each activity as row (row.id)}
          <ActivityRow {row} {statuses} {labels} {members} />
        {/each}
      </div>
    {/if}
  </section>
{/snippet}

{#snippet allPanel()}
  <section class="activity-panel card" aria-label="All activity">
    {#if activity.length === 0}
      <p class="empty">No activity yet.</p>
    {:else}
      <div class="activity-list" role="list">
        {#each activity as row (row.id)}
          {@const comment = commentForRow(row)}
          <ActivityRow {row} {statuses} {labels} {members} expandedBody={comment && !comment.isDeleted ? comment.body : null} expandedTombstone={Boolean(comment?.isDeleted)} />
        {/each}
      </div>
    {/if}
  </section>
{/snippet}

<style>
  .activity-panel {
    padding: 0.6rem 0.85rem;
  }

  .activity-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .activity-list :global(.activity-row + .activity-row) {
    border-top: var(--border);
  }

  .empty {
    margin: 0;
    padding: 0.5rem 0;
    color: var(--colour-muted);
    font-size: 0.85rem;
    font-style: italic;
  }
</style>
