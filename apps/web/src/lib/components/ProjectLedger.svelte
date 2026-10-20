<script lang="ts">
  import { resolve } from "$app/paths";
  import { Globe2, Lock } from "@lucide/svelte";
  import { filterProjects, projectStack, sortProjects, type HomeProject, type ProjectSort } from "$lib/homeProjects";
  import { timeAgo } from "$lib/time";
  import SearchInput from "$lib/components/ui/SearchInput.svelte";
  import SegmentedControl, { type SegmentedOption } from "$lib/components/ui/SegmentedControl.svelte";

  let { projects }: { projects: HomeProject[] } = $props();

  const sortOptions: SegmentedOption<ProjectSort>[] = [
    { value: "recent", label: "Recent" },
    { value: "name", label: "Name" },
    { value: "open", label: "Open" },
  ];

  let query = $state("");
  let sort = $state<ProjectSort>("recent");
  let filterInput: HTMLInputElement | null = $state(null);

  const visibleProjects = $derived(sortProjects(filterProjects(projects, query), sort));

  /** A project is public when it is not locked and not marked private. The signed-out list has no visibility field. */
  function isPublic(project: HomeProject) {
    return "visibility" in project ? project.visibility === "public" : true;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, select, [contenteditable]") || document.querySelector("dialog[open]")) return;
    event.preventDefault();
    filterInput?.focus();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#snippet rowContent(project: HomeProject)}
  {@const stack = projectStack(project)}
  <span class="key">{project.key}</span>
  <div class="main">
    <div class="name-line">
      <span class="name">{project.name}</span>
      {#if project.isLocked}
        <span class="locked-note"><Lock size={12} strokeWidth={2} /> Private</span>
      {:else if isPublic(project)}
        <Globe2 size={12} strokeWidth={2} aria-label="Public" />
      {:else}
        <Lock size={12} strokeWidth={2} aria-label="Private" />
      {/if}
    </div>
    {#if project.description}<div class="description">{project.description}</div>{/if}
    {#if stack.length > 0}<div class="stack">{stack.join(" · ")}</div>{/if}
  </div>
  <div class="meta">
    <div class="open-count" data-empty={project.openCount === 0}>{project.openCount}<small>open</small></div>
    <div class="updated">
      {#if project.isLocked}Tickets hidden{:else if project.lastActivityAt}{timeAgo(project.lastActivityAt)}{:else}No activity{/if}
    </div>
  </div>
{/snippet}

<div>
  <div class="tools">
    <div class="filter">
      <SearchInput bind:value={query} bind:inputElement={filterInput} placeholder="Filter projects" shortcut="/" />
    </div>
    <div class="sort">
      <span>Sort</span>
      <SegmentedControl bind:value={sort} options={sortOptions} label="Sort projects" size="sm" />
    </div>
  </div>

  {#if visibleProjects.length === 0}
    <p class="no-match">No project matches that filter.</p>
  {:else}
    <ul class="ledger">
      {#each visibleProjects as project (project.id)}
        <li>
          {#if project.isLocked}
            <div class="row" data-locked="true" title="Private project. Only members can open it.">{@render rowContent(project)}</div>
          {:else}
            <a class="row" href={resolve("/projects/[key]", { key: project.key })}>{@render rowContent(project)}</a>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .filter {
    flex: 1 1 14rem;
    max-width: 20rem;
  }

  .sort {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: auto;
    color: var(--colour-muted);
    font-size: 0.8rem;
  }

  .ledger {
    list-style: none;
    padding: 0;
    margin: 0;
    overflow: hidden;
    border: var(--border);
    border-radius: var(--border-radius-outer);
    background: var(--colour-bg-lighter);
    box-shadow: var(--box-shadow);
  }

  .row {
    display: grid;
    grid-template-columns: 4.5rem minmax(0, 1fr) 6.5rem;
    gap: 1rem;
    align-items: center;
    padding: 0.875rem 1rem;
    border-top: var(--border);
    color: inherit;
    text-decoration: none;
    transition: background var(--motion-fast) var(--ease-out-quart);
  }

  li:first-child .row {
    border-top: 0;
  }

  a.row:hover {
    background: var(--colour-bg-hover);
  }

  a.row:focus-visible {
    outline-offset: -2px;
    border-radius: var(--border-radius-outer);
  }

  .row[data-locked="true"] {
    cursor: default;
  }

  .key {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--accent-base);
  }

  .row[data-locked="true"] .key,
  .row[data-locked="true"] .name-line {
    color: var(--colour-text-secondary);
  }

  .main {
    min-width: 0;
  }

  .name-line {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--colour-text);
    font-weight: 600;
    letter-spacing: -0.01em;

    & :global(svg) {
      flex: none;
      color: var(--colour-muted);
    }
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .locked-note {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--colour-muted);
    font-size: 0.75rem;
    font-weight: 500;
  }

  .description {
    margin-top: 0.125rem;
    overflow: hidden;
    color: var(--colour-text-secondary);
    font-size: 0.875rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .stack {
    margin-top: 0.25rem;
    overflow: hidden;
    color: var(--colour-muted);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta {
    line-height: 1.3;
    text-align: right;
  }

  .open-count {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-weight: 600;

    & small {
      margin-left: 0.25rem;
      color: var(--colour-muted);
      font-family: var(--font-body);
      font-size: 0.75rem;
      font-weight: 400;
    }

    &[data-empty="true"] {
      color: var(--colour-muted);
    }
  }

  .updated {
    color: var(--colour-muted);
    font-size: 0.75rem;
  }

  .no-match {
    padding: 1rem 0;
    color: var(--colour-muted);
    font-size: 0.875rem;
  }

  @media (max-width: 40rem) {
    .row {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas:
        "key meta"
        "main main";
      gap: 0.5rem 1rem;
    }

    .key {
      grid-area: key;
    }

    .main {
      grid-area: main;
    }

    .meta {
      grid-area: meta;
      display: flex;
      align-items: baseline;
      gap: 0.75rem;
    }

    .sort {
      margin-left: 0;
    }
  }
</style>
