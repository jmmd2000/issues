<script lang="ts">
  import { resolve } from "$app/paths";
  import { Plus } from "@lucide/svelte";
  import type { PageProps } from "./$types";
  import Button from "$lib/components/ui/Button.svelte";
  import ProjectActivityCard from "$lib/components/projectDetail/ProjectActivityCard.svelte";
  import ProjectLedger from "$lib/components/ProjectLedger.svelte";

  let { data }: PageProps = $props();

  const projectCount = $derived(data.projects.length);
  const openTotal = $derived(data.projects.reduce((sum, project) => sum + project.openCount, 0));

  const summary = $derived.by(() => {
    if (projectCount === 0) return null;
    const projectWord = projectCount === 1 ? "project" : "projects";
    return `${projectCount} ${projectWord}, ${openTotal} open`;
  });
</script>

<svelte:head>
  <title>Projects · Issues</title>
</svelte:head>

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
        <ProjectLedger projects={data.projects} />
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
              {@const lookup = data.feed.lookups[event.project.key]}
              <ProjectActivityCard
                row={event}
                projectKey={event.project.key}
                isLocked={event.project.isLocked}
                statuses={lookup?.statuses ?? []}
                labels={lookup?.labels ?? []}
                members={lookup?.members ?? []}
              />
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
