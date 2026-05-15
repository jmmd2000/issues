<script lang="ts">
  import { fade, slide } from "svelte/transition";
  import { quartOut } from "svelte/easing";
  import { resolve } from "$app/paths";
  import type { ProjectActivity, ProjectDetail, ProjectStats } from "@issues/api";
  import { ExternalLink, PanelRightClose, PanelRightOpen, Settings } from "@lucide/svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import ProjectActivityCard from "$lib/components/projectDetail/ProjectActivityCard.svelte";
  import SectionToggle from "$lib/components/projectDetail/SectionToggle.svelte";
  import { formatAbsolute, timeAgo } from "$lib/time";

  const SECTION_SLIDE = { duration: 200, easing: quartOut };

  interface InfoPaneProps {
    project: ProjectDetail;
    stats: ProjectStats;
    activity: ProjectActivity[];
    collapsed: boolean;
    onToggleCollapsed: () => void;
  }

  let { project, stats, activity, collapsed, onToggleCollapsed }: InfoPaneProps = $props();

  const owner = $derived(project.members.find((m) => m.role === "owner") ?? null);
  const repoLabel = $derived(project.repo ? project.repo.replace(/^https?:\/\//, "") : null);

  let open = $state({ projectInfo: true, members: true, recent: true });

  function toggleSection(key: keyof typeof open) {
    open[key] = !open[key];
  }
</script>

<aside class="pane" class:collapsed aria-label="Project info">
  <header class="pane-head">
    <button
      type="button"
      class="collapse-button"
      onclick={onToggleCollapsed}
      aria-label={collapsed ? "Expand project info" : "Collapse project info"}
      title={collapsed ? "Expand project info" : "Collapse project info"}
    >
      {#if collapsed}<PanelRightOpen size={14} />{:else}<PanelRightClose size={14} />{/if}
    </button>
    {#if !collapsed}
      <h2>Project</h2>
      <Button variant="secondary" size="sm" href={resolve("/projects/[key]/settings", { key: project.key })} aria-label="Project settings">
        <Settings size={13} />
        Settings
      </Button>
    {/if}
  </header>

  {#if !collapsed}
    <div class="pane-scroll" in:fade={{ duration: 180, easing: quartOut, delay: 80 }} out:fade={{ duration: 120, easing: quartOut }}>
      <section class="info-section">
        <SectionToggle title="Project info" open={open.projectInfo} onToggle={() => toggleSection("projectInfo")} />
        {#if open.projectInfo}
          <div class="section-body" transition:slide={SECTION_SLIDE}>
            {#if project.description}
              <p class="project-description">{project.description}</p>
            {/if}
            <dl class="description-list">
              <div>
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
              <div>
                <dt>Visibility</dt>
                <dd class="capitalise">{project.visibility}</dd>
              </div>
              <div>
                <dt>Tickets</dt>
                <dd>
                  {#if stats.totalTickets === 0}
                    <span class="muted">None yet</span>
                  {:else}
                    <strong>{stats.openTickets}</strong> open · {stats.closedTickets} closed
                  {/if}
                </dd>
              </div>
              <div>
                <dt>Last activity</dt>
                <dd>{stats.lastActivityAt ? timeAgo(stats.lastActivityAt) : "Never"}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{formatAbsolute(project.createdAt)}</dd>
              </div>
              {#if project.repo}
                <div>
                  <dt>Source</dt>
                  <dd>
                    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
                    <a class="repo-link" href={project.repo} target="_blank" rel="noreferrer noopener" title={project.repo}>
                      <span class="repo-text">{repoLabel}</span>
                      <ExternalLink size={11} />
                    </a>
                  </dd>
                </div>
              {/if}
              {#if project.stack.length > 0}
                <div>
                  <dt>Stack</dt>
                  <dd>
                    <ul class="stack">
                      {#each project.stack as item (item)}<li>{item}</li>{/each}
                    </ul>
                  </dd>
                </div>
              {/if}
            </dl>
          </div>
        {/if}
      </section>

      <section class="info-section">
        <SectionToggle title="Members" open={open.members} onToggle={() => toggleSection("members")} count={project.members.length} />
        {#if open.members}
          <ul class="member-list" transition:slide={SECTION_SLIDE}>
            {#each project.members as member (member.userID)}
              {@const memberStats = stats.byMember?.[member.userID] ?? { assignedOpen: 0, assignedTotal: 0, reported: 0 }}
              <li>
                <UserAvatar name={member.user.name} avatarURL={member.user.avatarURL} size="md" />
                <div class="member-body">
                  <div class="member-id">
                    <span class="member-name">{member.user.name}</span>
                    {#if member.role === "owner"}<span class="owner-chip">owner</span>{/if}
                  </div>
                  <div class="member-stats">
                    <span><strong>{memberStats.assignedOpen}</strong> open</span>
                    <span class="dot-separator">·</span>
                    <span>{memberStats.reported} reported</span>
                  </div>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <section class="info-section">
        <SectionToggle title="Recent activity" open={open.recent} onToggle={() => toggleSection("recent")} />
        {#if open.recent}
          <div class="section-body" transition:slide={SECTION_SLIDE}>
            {#if activity.length === 0}
              <p class="muted-empty">No activity yet.</p>
            {:else}
              <ul class="activity-feed">
                {#each activity as row (row.id)}
                  <ProjectActivityCard {row} projectKey={project.key} statuses={project.statuses} labels={project.labels} members={project.members} />
                {/each}
              </ul>
            {/if}
          </div>
        {/if}
      </section>
    </div>
  {/if}
</aside>

<style>
  .pane {
    display: flex;
    flex-direction: column;
    min-width: 0;
    background: var(--colour-bg);
    border-left: var(--border);
  }

  .pane-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5em;
    padding: 0 1em 0 0.6em;
    border-bottom: var(--border);
    background: var(--colour-bg-lighter);
    flex-shrink: 0;
    height: 3.5em;
    box-sizing: border-box;
    position: sticky;
    top: 0;
    z-index: 2;

    h2 {
      font-size: 0.7em;
      font-weight: 700;
      color: var(--colour-muted);
      letter-spacing: 0.1em;
      text-transform: uppercase;
      flex: 1;
    }

    .collapse-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.8rem;
      height: 1.8rem;
      padding: 0;
      border: none;
      background: transparent;
      color: var(--colour-muted);
      cursor: pointer;
      border-radius: var(--border-radius-inner);
      flex-shrink: 0;

      &:hover {
        color: var(--colour-text);
        background: var(--colour-bg-hover);
      }
    }
  }

  .pane.collapsed .pane-head {
    justify-content: center;
    padding: 0;
  }

  .pane-scroll {
    padding: 0.9em 1em;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1em;
  }

  .info-section {
    display: flex;
    flex-direction: column;
    gap: 0.5em;
  }

  .section-body {
    display: flex;
    flex-direction: column;
    gap: 0.6em;
  }

  .project-description {
    font-size: 0.85em;
    line-height: 1.5;
    color: var(--colour-text);
    padding: 0 0.25em;
  }

  .description-list {
    display: flex;
    flex-direction: column;
    gap: 0.4em;
    margin: 0;
    font-size: 0.8em;

    & div {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 0.5em;
      min-width: 0;
    }

    & dt {
      color: var(--colour-muted);
      font-weight: 500;
      flex-shrink: 0;
    }

    & dd {
      margin: 0;
      color: var(--colour-text);
      text-align: right;
      min-width: 0;
      overflow: hidden;
    }

    & strong {
      font-weight: 700;
    }
  }

  .person {
    display: inline-flex;
    align-items: center;
    gap: 0.35em;
  }

  .capitalise {
    text-transform: capitalize;
  }

  .muted {
    color: var(--colour-muted);
  }

  .repo-link {
    display: inline-flex;
    align-items: center;
    gap: 0.25em;
    color: var(--accent-base);
    text-decoration: none;
    max-width: 100%;
    min-width: 0;

    &:hover {
      text-decoration: underline;
    }
  }

  .repo-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .stack {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25em;
    justify-content: flex-end;

    & li {
      font-size: 0.75em;
      font-weight: 500;
      padding: 0.1em 0.45em;
      border: var(--border);
      border-radius: var(--border-radius-inner);
      color: var(--colour-text-secondary);
    }
  }

  .member-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.55em;

    & li {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      align-items: center;
      gap: 0.7em;
      padding: 0.7em 0.8em;
      background: var(--colour-bg-lighter);
      border: var(--border);
      border-radius: var(--border-radius-inner);
    }
  }

  .member-body {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3em;
  }

  .member-id {
    display: flex;
    align-items: center;
    gap: 0.5em;
    min-width: 0;
  }

  .member-name {
    font-size: 0.9em;
    font-weight: 600;
    color: var(--colour-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .owner-chip {
    font-size: 0.6em;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.15em 0.5em;
    border-radius: 999px;
    background: var(--accent-tint-800);
    color: var(--accent-shade-200);
    flex-shrink: 0;
  }

  .member-stats {
    display: inline-flex;
    align-items: baseline;
    gap: 0.35em;
    font-size: 0.8em;
    color: var(--colour-text-secondary);

    & strong {
      color: inherit;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
  }

  .dot-separator {
    color: var(--colour-muted);
  }

  .activity-feed {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.55em;
  }

  .muted-empty {
    color: var(--colour-muted);
    font-size: 0.8em;
    padding: 0.2em 0.25em;
  }
</style>
