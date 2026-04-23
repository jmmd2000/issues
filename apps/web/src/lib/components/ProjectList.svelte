<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import type { Project, CurrentUser } from "@issues/api";
  import Button from "$lib/components/ui/Button.svelte";
  import { Plus } from "@lucide/svelte";

  let { projects, user }: { projects: Project[]; user: CurrentUser | null } = $props();
</script>

<section class="projects">
  <div class="title-row">
    <div class="header">
      <h1>Projects</h1>
      <p>All of your tracked projects.</p>
    </div>
    {#if user}
      <Button href={resolve("/projects/new")}>
        <Plus size={13} strokeWidth={4} /> New project
      </Button>
    {/if}
  </div>
  <table>
    <thead>
      <tr>
        <th>Key</th>
        <th>Name</th>
        <th>Description</th>
      </tr>
    </thead>
    <tbody>
      {#each projects as project (project.id)}
        <tr
          role="link"
          tabindex="0"
          onclick={() => goto(resolve("/projects/[key]", { key: project.key }))}
          onkeydown={(e) => (e.key === "Enter" ? goto(resolve("/projects/[key]", { key: project.key })) : null)}
        >
          <td class="project-key">{project.key}</td>
          <td>{project.name}</td>
          <td>{project.description ?? "—"}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</section>

<style>
  .projects {
    width: min(100%, 70rem);
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .header {
    display: flex;
    flex-direction: column;
    gap: 0.5em;
  }

  .title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  table {
    border-collapse: separate;
    border-spacing: 0;

    border-radius: var(--border-radius-outer);
    overflow: hidden;
    box-shadow:
      0 0 0 1px var(--colour-border),
      var(--box-shadow);
  }

  thead th {
    background-color: var(--colour-bg-hover);
    color: var(--colour-text-secondary);
    font-weight: 600;
    font-size: 0.875rem;
    text-align: left;
    padding: 0.75em 1em;
    border-bottom: 1px solid var(--colour-border);
  }

  tbody td {
    padding: 1em;
    text-align: left;
    border-bottom: 1px solid var(--colour-border);
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  tbody tr {
    transition: background-color 0.15s ease;
    background-color: var(--colour-bg-lighter);
  }

  tbody tr:hover {
    background-color: var(--accent-tint-900);
    cursor: pointer;
  }

  .project-key {
    font-family: var(--font-mono);
    font-weight: 600;
    color: var(--accent-base);
  }
</style>
