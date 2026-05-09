<script lang="ts">
  import type { Label, ProjectActivity, ProjectDetail, ProjectMember, ProjectStats, Status } from "@issues/api";
  import { ExternalLink } from "@lucide/svelte";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import ActivityRow from "$lib/components/tickets/ActivityRow.svelte";
  import { formatAbsolute, timeAgo } from "$lib/time";

  interface ProjectOverviewProps {
    project: ProjectDetail;
    stats: ProjectStats;
    activity: ProjectActivity[];
    statuses: Status[];
    labels: Label[];
    members: ProjectMember[];
  }

  let { project, stats, activity, statuses, labels, members }: ProjectOverviewProps = $props();

  const owner = $derived(project.members.find((member) => member.role === "owner") ?? null);
  const repoLabel = $derived(project.repo ? project.repo.replace(/^https?:\/\//, "") : null);
</script>

<section class="overview">
  <div class="metadata card">
    <h2>About</h2>

    <dl class="metadata-list">
      <div class="metadata-row">
        <dt>Owner</dt>
        <dd>
          {#if owner}
            <span class="person">
              <UserAvatar name={owner.user.name} avatarURL={owner.user.avatarURL} size="sm" />
              <span>{owner.user.name}</span>
            </span>
          {:else}
            <span class="muted">Unassigned</span>
          {/if}
        </dd>
      </div>

      <div class="metadata-row">
        <dt>Visibility</dt>
        <dd class="capitalise">{project.visibility}</dd>
      </div>

      <div class="metadata-row">
        <dt>Created</dt>
        <dd title={formatAbsolute(project.createdAt)}>{formatAbsolute(project.createdAt)}</dd>
      </div>

      <div class="metadata-row">
        <dt>Last activity</dt>
        <dd>
          {#if stats.lastActivityAt}
            <span title={formatAbsolute(stats.lastActivityAt)}>{timeAgo(stats.lastActivityAt)}</span>
          {:else}
            <span class="muted">No activity yet</span>
          {/if}
        </dd>
      </div>

      <div class="metadata-row">
        <dt>Repository</dt>
        <dd>
          {#if project.repo}
            <a class="repo-link" href={project.repo} target="_blank" rel="noreferrer noopener">
              <span>{repoLabel}</span>
              <ExternalLink size={12} />
            </a>
          {:else}
            <span class="muted">Not linked</span>
          {/if}
        </dd>
      </div>
    </dl>
  </div>

  <div class="stats card">
    <h2>Tickets</h2>

    <div class="stat-grid">
      <div class="stat">
        <span class="stat-value">{stats.totalTickets}</span>
        <span class="stat-label">Total</span>
      </div>
      <div class="stat">
        <span class="stat-value">{stats.openTickets}</span>
        <span class="stat-label">Open</span>
      </div>
      <div class="stat">
        <span class="stat-value">{stats.closedTickets}</span>
        <span class="stat-label">Closed</span>
      </div>
    </div>
  </div>

  <div class="feed card">
    <h2>Recent activity</h2>

    {#if activity.length === 0}
      <p class="empty">No activity yet.</p>
    {:else}
      <div class="feed-list" role="list">
        {#each activity as row (row.id)}
          <ActivityRow {row} {statuses} {labels} {members} ticketRef={{ projectKey: project.key, number: row.ticket.number, title: row.ticket.title }} />
        {/each}
      </div>
    {/if}
  </div>
</section>

<style>
  .overview {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1rem;
    align-items: start;
  }

  .feed {
    grid-column: 1 / -1;
  }

  h2 {
    color: var(--colour-text);
    font-size: 0.85rem;
    font-weight: 800;
    margin-bottom: 0.85rem;
  }

  .metadata-list {
    display: grid;
    gap: 0.7rem;
    margin: 0;
  }

  .metadata-row {
    display: grid;
    grid-template-columns: minmax(7rem, 0.4fr) minmax(0, 1fr);
    gap: 0.75rem;
    align-items: center;
  }

  .metadata-list dt {
    color: var(--colour-muted);
    font-size: 0.8rem;
    font-weight: 700;
  }

  .metadata-list dd {
    margin: 0;
    color: var(--colour-text);
    font-size: 0.85rem;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .person {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    white-space: nowrap;
  }

  .muted {
    color: var(--colour-muted);
    font-weight: 500;
  }

  .capitalise {
    text-transform: capitalize;
  }

  .repo-link {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--accent-base);
    text-decoration: none;
    word-break: break-all;

    &:hover {
      text-decoration: underline;
    }
  }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.75rem;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.75rem;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg);
  }

  .stat-value {
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--colour-text);
    line-height: 1;
  }

  .stat-label {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--colour-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .feed-list {
    display: flex;
    flex-direction: column;
  }

  .feed-list :global(.activity-row + .activity-row) {
    border-top: var(--border);
  }

  .empty {
    margin: 0;
    padding: 0.5rem 0;
    color: var(--colour-muted);
    font-size: 0.85rem;
    font-style: italic;
  }

  @media (max-width: 720px) {
    .overview {
      grid-template-columns: 1fr;
    }
  }
</style>
