<script lang="ts">
  import { resolve } from "$app/paths";
  import { Plus } from "@lucide/svelte";
  import type { PageProps } from "./$types";
  import Button from "$lib/components/ui/Button.svelte";
  import ProjectActivityCard from "$lib/components/projectDetail/ProjectActivityCard.svelte";

  let { data }: PageProps = $props();

  const projectCount = $derived(data.projects.length);
  const openTotal = $derived(data.projects.reduce((sum, project) => sum + project.openCount, 0));

  const summary = $derived.by(() => {
    if (projectCount === 0) return null;
    const projectWord = projectCount === 1 ? "project" : "projects";
    return `${projectCount} ${projectWord}, ${openTotal} open`;
  });

  function projectHref(key: string) {
    return resolve("/projects/[key]", { key });
  }
</script>

<div class="home">
  <header class="title-row">
    <div class="title-block">
      <h1>Projects</h1>
      {#if summary}
        <p class="summary">{summary}</p>
      {/if}
    </div>
    {#if data.user && data.projects.length > 0}
      <Button href={resolve("/projects/new")}>
        <Plus size={13} strokeWidth={4} />
        New project
      </Button>
    {/if}
  </header>

  <div class="grid" class:single-column={!data.user && data.projects.length === 0}>
    <section class="projects" aria-labelledby="projects-heading">
      <h2 id="projects-heading" class="visually-hidden">Projects</h2>
      {#if data.projects.length === 0}
        <div class="empty">
          {#if data.user}
            <p>No projects yet.</p>
            <Button href={resolve("/projects/new")}>
              <Plus size={13} strokeWidth={4} />
              New project
            </Button>
          {:else}
            <p>This instance has no projects yet.</p>
            {#if data.registrationOpen}
              <Button href={resolve("/register")}>Register</Button>
            {:else}
              <Button href={resolve("/login")}>Login</Button>
            {/if}
          {/if}
        </div>
      {:else}
        <ul class="project-list">
          {#each data.projects as project (project.id)}
            <li>
              <a class="project-card" href={projectHref(project.key)}>
                <header class="project-head">
                  <code class="project-key">{project.key}</code>
                  <span class="project-rule" aria-hidden="true"></span>
                  <span class="project-count">
                    <span class="project-count-number" data-empty={project.openCount === 0}>{project.openCount}</span>
                    <span class="project-count-label">open</span>
                  </span>
                </header>
                <h3 class="project-name">{project.name}</h3>
                {#if project.description}
                  <p class="project-description">{project.description}</p>
                {/if}
                {#if "stack" in project && Array.isArray(project.stack) && project.stack.length > 0}
                  <ul class="project-stack" aria-label="Stack">
                    {#each project.stack as tech (tech)}
                      <li class="project-stack-item">{tech}</li>
                    {/each}
                  </ul>
                {/if}
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    {#if data.feed}
      <aside class="rail" aria-labelledby="activity-heading">
        <h2 id="activity-heading" class="rail-heading">Activity</h2>
        {#if data.feed.error}
          <p class="rail-empty">Activity is unavailable right now.</p>
        {:else if data.feed.events.length === 0}
          <p class="rail-empty">No activity yet.</p>
        {:else}
          <ul class="rail-feed">
            {#each data.feed.events as event (event.id)}
              <ProjectActivityCard row={event} projectKey={event.project.key} statuses={[]} labels={[]} members={[]} />
            {/each}
          </ul>
        {/if}
      </aside>
    {/if}
  </div>
</div>

<style>
  .home {
    width: min(100%, 70rem);
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .title-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  .title-block {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  h1 {
    font-size: 1.3em;
    font-weight: 600;
    letter-spacing: -0.01em;
    line-height: 1.2;
  }

  .summary {
    font-size: 0.95rem;
    color: var(--colour-muted);
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr 22rem;
    gap: 2rem;
    align-items: start;
  }

  .grid.single-column {
    grid-template-columns: 1fr;
  }

  @media (max-width: 900px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 2rem 0;
    color: var(--colour-muted);
  }

  .project-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .project-card {
    display: block;
    padding: 1.1rem 1.25rem 1.15rem;
    background: var(--colour-bg-lighter);
    border: var(--border);
    border-radius: var(--border-radius-inner);
    color: inherit;
    text-decoration: none;
    transition:
      border-color var(--motion-fast) var(--ease-out-quart),
      box-shadow var(--motion-fast) var(--ease-out-quart),
      transform 60ms var(--ease-out-quart);
  }

  .project-card:hover {
    border-color: var(--accent-tint-600);
    box-shadow: var(--box-shadow);
  }

  .project-card:hover .project-key {
    color: var(--accent-shade-100);
    background: var(--accent-tint-800);
  }

  .project-card:active {
    transform: translateY(1px);
  }

  .project-head {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    margin-bottom: 0.65rem;
  }

  .project-key {
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--accent-base);
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    line-height: 1;
    flex-shrink: 0;
    padding: 0.2rem 0.45rem;
    margin: -0.2rem -0.45rem;
    border-radius: var(--border-radius-inner);
    transition:
      color var(--motion-fast) var(--ease-out-quart),
      background var(--motion-fast) var(--ease-out-quart);
  }

  .project-rule {
    flex: 1;
    height: 1px;
    background: var(--colour-border);
    min-width: 1rem;
  }

  .project-count {
    display: inline-flex;
    align-items: baseline;
    gap: 0.3rem;
    flex-shrink: 0;
    line-height: 1;
  }

  .project-count-number {
    font-family: var(--font-mono);
    font-weight: 600;
    color: var(--accent-base);
    font-variant-numeric: tabular-nums;
    font-size: 0.9rem;
    transition: color var(--motion-fast) var(--ease-out-quart);
  }

  .project-count-number[data-empty="true"] {
    color: var(--colour-muted);
  }

  .project-count-label {
    color: var(--colour-muted);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .project-name {
    font-size: 1.1rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--colour-text);
    margin: 0;
    line-height: 1.3;
  }

  .project-description {
    margin-top: 0.4rem;
    font-size: 0.875rem;
    line-height: 1.55;
    color: var(--colour-text-secondary);
    max-width: 65ch;
  }

  .project-stack {
    list-style: none;
    padding: 0;
    margin: 0.85rem 0 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
  }

  .project-stack-item {
    padding: 0.15rem 0.55rem;
    border: 1px solid var(--accent-tint-700);
    border-radius: 999px;
    background: var(--colour-bg);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 500;
    letter-spacing: 0.02em;
    line-height: 1.4;
    color: var(--colour-text-secondary);
  }

  .rail {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
  }

  .rail-heading {
    font-size: 0.7em;
    font-weight: 700;
    color: var(--colour-muted);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .rail-empty {
    color: var(--colour-muted);
    font-size: 0.85em;
  }

  .rail-feed {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.55em;
  }

</style>
