<script lang="ts">
  import type { ProjectMember, ProjectStats } from "@issues/api";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import { formatAbsolute } from "$lib/time";

  interface ProjectMembersProps {
    members: ProjectMember[];
    stats: ProjectStats;
  }

  let { members, stats }: ProjectMembersProps = $props();

  // Owner first, then members alphabetical by name.
  const sorted = $derived(
    [...members].sort((a, b) => {
      if (a.role !== b.role) return a.role === "owner" ? -1 : 1;
      return a.user.name.localeCompare(b.user.name);
    })
  );

  function statsFor(userID: string) {
    return stats.byMember[userID] ?? { assignedOpen: 0, assignedTotal: 0, reported: 0 };
  }
</script>

<section class="members">
  <header class="members-header">
    <h2>Members</h2>
    <span class="count">{members.length}</span>
  </header>

  <ul class="member-list">
    {#each sorted as member (member.userID)}
      {@const counts = statsFor(member.userID)}
      <li class="member">
        <div class="identity">
          <UserAvatar name={member.user.name} avatarURL={member.user.avatarURL} size="md" />
          <span class="name">
            {member.user.name}
            <span class="role" class:owner={member.role === "owner"}>{member.role}</span>
          </span>
        </div>

        <dl class="member-stats">
          <div class="stat">
            <dt>Assigned · open</dt>
            <dd>{counts.assignedOpen}</dd>
          </div>
          <div class="stat">
            <dt>Assigned · all</dt>
            <dd>{counts.assignedTotal}</dd>
          </div>
          <div class="stat">
            <dt>Reported</dt>
            <dd>{counts.reported}</dd>
          </div>
        </dl>

        <span class="joined" title={formatAbsolute(member.joinedAt)}>Joined {formatAbsolute(member.joinedAt)}</span>
      </li>
    {/each}
  </ul>
</section>

<style>
  .members {
    border: var(--border);
    border-radius: var(--border-radius-outer);
    background: var(--colour-bg-lighter);
    box-shadow: var(--box-shadow);
    padding: 1rem;
  }

  .members-header {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    margin-bottom: 0.85rem;

    & h2 {
      color: var(--colour-text);
      font-size: 0.85rem;
      font-weight: 800;
    }
  }

  .count {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--colour-muted);
    background: var(--colour-bg);
    border: var(--border);
    border-radius: 999px;
    padding: 0.1rem 0.5rem;
    line-height: 1.2;
  }

  .member-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .member {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.6fr) minmax(0, 0.8fr);
    align-items: center;
    gap: 1rem;
    padding: 0.7rem 0.85rem;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg);
  }

  .identity {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-width: 0;
  }

  .name {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
    color: var(--colour-text);
    font-weight: 700;
    font-size: 0.9rem;
    overflow-wrap: anywhere;
  }

  .role {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.1rem 0.4rem;
    border-radius: 999px;
    background: var(--colour-bg-lighter);
    border: var(--border);
    color: var(--colour-muted);

    &.owner {
      color: var(--accent-shade-200);
      background: var(--accent-tint-800);
      border-color: var(--accent-tint-600);
    }
  }

  .member-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;
    margin: 0;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.1rem;
  }

  .stat dt {
    font-size: 0.7rem;
    color: var(--colour-muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stat dd {
    margin: 0;
    font-size: 1rem;
    font-weight: 800;
    color: var(--colour-text);
    line-height: 1;
  }

  .joined {
    text-align: right;
    color: var(--colour-muted);
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
  }

  @media (max-width: 720px) {
    .member {
      grid-template-columns: 1fr;
      gap: 0.6rem;
    }

    .joined {
      text-align: left;
    }
  }
</style>
