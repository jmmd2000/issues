<script lang="ts">
  import { resolve } from "$app/paths";
  import { Info, Plus, Settings, Ticket as TicketIcon, UsersRound } from "@lucide/svelte";
  import type { PageProps } from "./$types";
  import Button from "$lib/components/ui/Button.svelte";
  import Tabs from "$lib/components/ui/Tabs.svelte";
  import TicketsView from "$lib/components/tickets/TicketsView.svelte";

  let { data }: PageProps = $props();
  let project = $derived(data.project);
  let statuses = $derived(data.statuses);
</script>

<svelte:head>
  <title>{data.project.name} · Issues</title>
</svelte:head>

<section class="project-page">
  <div class="project-header">
    <div class="project-info">
      <div class="project-topline">
        <p>{project.key}</p>
        <span class="visibility">{project.visibility}</span>
      </div>

      <div class="project-headline">
        <h1>{project.name}</h1>
        <p>{project.description || "No project description yet."}</p>
      </div>

      {#if project.stack.length > 0}
        <div class="stack">
          {#each project.stack as item (item)}
            <span class="stack-item">{item}</span>
          {/each}
        </div>
      {/if}
    </div>

    <div class="supplemental-info">
      <Button size="md" variant="secondary" href={resolve("/projects/[key]/settings", { key: project.key })} aria-label="Project settings"><Settings size={14} /> Settings</Button>
      <Button href={resolve("/projects/[key]/tickets/new", { key: project.key })}><Plus size={13} strokeWidth={4} /> New ticket</Button>
    </div>
  </div>

  <div class="project-content">
    {#snippet ticketsPanel()}
      <TicketsView project={data.project} {statuses} labels={data.labels} members={data.members} view={data.ticketView} ticketData={data.ticketData} backlog={data.backlog} filters={data.filters} />
    {/snippet}
    {#snippet overviewPanel()}Overview content{/snippet}
    {#snippet membersPanel()}Members content{/snippet}

    <Tabs
      tabs={[
        { id: "tickets", label: "Tickets", icon: TicketIcon },
        { id: "overview", label: "Overview", icon: Info },
        { id: "members", label: "Members", icon: UsersRound },
      ]}
      panels={{ tickets: ticketsPanel, overview: overviewPanel, members: membersPanel }}
    />
  </div>
</section>

<style>
  .project-page {
    padding-top: 0.5em;
  }

  .project-header {
    display: flex;
    justify-content: space-between;
  }

  .project-headline h1 {
    max-width: 20em;
    color: var(--colour-text);
    font-size: clamp(1.8rem, 1.6vw + 1.3rem, 3rem);
    line-height: 1.05;
    overflow-wrap: anywhere;
  }

  .project-info {
    display: flex;
    flex-direction: column;
  }

  .project-topline {
    display: flex;
    align-items: center;
    gap: 0.75em;
    margin-bottom: 0.4em;

    & p {
      font-family: var(--font-mono);
      font-weight: 600;
      color: var(--accent-base);
      font-size: 0.85em;
      letter-spacing: 0.01em;
    }

    & .visibility {
      color: var(--accent-shade-200);
      padding: 0.2em 0.6em;
      border-radius: 999px;
      background: var(--accent-tint-800);
      text-transform: capitalize;
      font-size: 0.85em;
      font-weight: 600;
    }
  }

  .project-headline {
    display: flex;
    flex-direction: column;
    gap: 0.4em;
    margin-bottom: 0.65em;

    & h1 {
      font-size: 2.2em;
      letter-spacing: -0.01em;
    }

    & p {
      font-size: 0.9em;
      color: var(--colour-text-secondary);
      max-width: 65ch;
      line-height: 1.5;
      letter-spacing: 0.01em;
    }
  }

  .stack {
    display: flex;
    gap: 0.4em;
  }

  .stack-item {
    font-size: 0.8em;
    font-weight: 600;
    color: var(--colour-text-secondary);
    padding: 0.3em 0.7em;
    border-radius: 999px;
    border: var(--border);
  }

  .project-content {
    margin-top: 1.2em;
  }

  .supplemental-info {
    display: flex;
    align-items: center;
    gap: 0.6em;
  }

  @media (max-width: 640px) {
    .project-header {
      flex-direction: column;
      gap: 1em;
    }
  }
</style>
