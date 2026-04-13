<script lang="ts">
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>{data.project.name} · Issues</title>
</svelte:head>

<section class="project-page">
  <section class="workspace">
    <aside class="project-rail">
      <div class="rail-card project-summary">
        <div class="eyebrow-row">
          <span class="project-key">{data.project.key}</span>
          <span class:private={data.project.visibility === "private"} class="visibility-pill">
            {data.project.visibility}
          </span>
        </div>
        <h1>{data.project.name}</h1>
        <p class="description">{data.project.description || "No project description yet."}</p>

        <dl class="project-info">
          <div>
            <dt>Members</dt>
            <dd>{data.project.members.length}</dd>
          </div>
          <div>
            <dt>Repository</dt>
            <dd>
              {#if data.project.repo}
                <a href={data.project.repo} target="_blank" rel="external">{data.project.repo}</a>
              {:else}
                <span>Not linked</span>
              {/if}
            </dd>
          </div>
        </dl>
      </div>

      {#if data.project.stack.length > 0}
        <div class="rail-card">
          <h2>Stack</h2>
          <div class="stack-list" aria-label="Project stack">
            {#each data.project.stack as item (item)}
              <span>{item}</span>
            {/each}
          </div>
        </div>
      {/if}
    </aside>

    <div class="tickets-panel">
      <div class="panel-header">
        <h2>Tickets</h2>
      </div>
    </div>
  </section>
</section>

<style>
  .project-page {
    padding-top: 0.5rem;
  }

  .workspace {
    display: grid;
    grid-template-columns: minmax(16rem, 20rem) minmax(0, 1fr);
    gap: 1.25rem;
    align-items: start;
  }

  .project-rail {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    position: sticky;
    top: 1rem;
  }

  .rail-card,
  .tickets-panel {
    padding: 1.25rem;
    border: var(--border);
    border-radius: var(--border-radius-outer);
    background: var(--colour-bg-lighter);
    box-shadow: var(--box-shadow);
  }

  .project-summary {
    padding: 1.5rem 1.75rem;
  }

  .eyebrow-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .project-key {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--accent-base);
    text-transform: uppercase;
  }

  .visibility-pill {
    padding: 0.3rem 0.65rem;
    border-radius: 999px;
    background-color: var(--accent-tint-800);
    color: var(--accent-shade-200);
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: capitalize;
  }

  .visibility-pill.private {
    background-color: var(--accent-tint-800);
    color: var(--colour-text);
  }

  h1,
  h2,
  p {
    margin: 0;
  }

  h1 {
    max-width: 14ch;
    font-size: clamp(2rem, 3vw, 2.7rem);
    line-height: 0.98;
    letter-spacing: -0.04em;
  }

  h2 {
    font-size: 1.1rem;
    letter-spacing: -0.03em;
  }

  .description {
    max-width: 58ch;
    margin-top: 1rem;
    color: var(--colour-text-secondary);
    line-height: 1.6;
    font-size: 1rem;
  }

  .stack-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
    margin-top: 1.25rem;
  }

  .stack-list span {
    padding: 0.45rem 0.7rem;
    border-radius: 999px;
    background-color: var(--colour-bg);
    border: var(--border);
    color: var(--colour-text-secondary);
    font-size: 0.82rem;
    font-weight: 600;
  }

  .panel-header {
    display: flex;
    align-items: flex-start;
    margin-bottom: 1rem;
  }

  .project-info {
    margin: 1.5rem 0 0;
    display: grid;
    gap: 0.9rem;
  }

  .project-info div {
    display: grid;
    gap: 0.2rem;
    padding-top: 0.9rem;
    border-top: var(--border);
  }

  .project-info dt {
    color: var(--colour-muted);
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .project-info dd {
    margin: 0;
    color: var(--colour-text);
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .project-info a {
    color: var(--accent-base);
    text-decoration: none;
  }

  .rail-card h2 {
    margin-bottom: 1rem;
    font-size: 0.95rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--colour-muted);
  }

  .tickets-panel {
    min-height: 38rem;
  }

  @media (max-width: 820px) {
    .workspace {
      grid-template-columns: 1fr;
    }

    .project-rail {
      position: static;
    }
  }

  @media (max-width: 640px) {
    .rail-card,
    .tickets-panel,
    .project-summary {
      padding: 1rem;
    }

    h1 {
      max-width: none;
    }
  }
</style>
