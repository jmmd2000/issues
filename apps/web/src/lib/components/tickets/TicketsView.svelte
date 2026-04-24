<script module lang="ts">
  import type { Ticket } from "@issues/api";

  export type TicketViewMode = "kanban" | "list";
  export type TicketData = { kind: "kanban"; tickets: Ticket[] } | { kind: "list"; tickets: Ticket[]; page: number; perPage: number; hasNextPage: boolean };
</script>

<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import type { ProjectDetail, ProjectMember, Status } from "@issues/api";
  import { Columns3, List } from "@lucide/svelte";
  import TicketKanban from "$lib/components/kanban/TicketKanban.svelte";
  import TicketList from "./TicketList.svelte";

  let {
    project,
    statuses,
    members,
    view,
    ticketData,
  }: {
    project: ProjectDetail;
    statuses: Status[];
    members: ProjectMember[];
    view: TicketViewMode;
    ticketData: TicketData;
  } = $props();

  async function updateSearchParams(params: Record<string, string | null>) {
    const next = new URL(page.url);
    for (const [key, value] of Object.entries(params)) {
      if (value === null) next.searchParams.delete(key);
      else next.searchParams.set(key, value);
    }
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    await goto(`${next.pathname}${next.search}`, { keepFocus: true, noScroll: true });
  }

  function setView(nextView: TicketViewMode) {
    void updateSearchParams({
      view: nextView === "kanban" ? null : nextView,
      page: null,
      perPage: nextView === "kanban" ? null : page.url.searchParams.get("perPage"),
    });
  }

  function setListPage(nextPage: number) {
    void updateSearchParams({ view: "list", page: String(nextPage) });
  }
</script>

<section class="tickets-view">
  <div class="tickets-toolbar">
    <div class="view-toggle" role="group" aria-label="Ticket view">
      <button type="button" class:active={view === "kanban"} aria-pressed={view === "kanban"} onclick={() => setView("kanban")}>
        <Columns3 size={14} />
        Kanban
      </button>
      <button type="button" class:active={view === "list"} aria-pressed={view === "list"} onclick={() => setView("list")}>
        <List size={14} />
        List
      </button>
    </div>
  </div>

  {#if ticketData.kind === "kanban"}
    <TicketKanban projectKey={project.key} projectID={project.id} {statuses} tickets={ticketData.tickets} />
  {:else}
    <TicketList projectKey={project.key} {statuses} {members} tickets={ticketData.tickets} page={ticketData.page} hasNextPage={ticketData.hasNextPage} onPageChange={setListPage} />
  {/if}
</section>

<style>
  .tickets-view {
    display: grid;
    gap: 0.8em;
  }

  .tickets-toolbar {
    display: flex;
    justify-content: flex-start;
  }

  .view-toggle {
    display: inline-flex;
    padding: 0.2em;
    gap: 0.15em;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg-lighter);
    box-shadow: var(--box-shadow);
  }

  .view-toggle button {
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    padding: 0.4em 0.65em;
    border: none;
    border-radius: var(--border-radius-inner);
    background: transparent;
    color: var(--colour-text-secondary);
    font-family: inherit;
    font-size: 0.78em;
    font-weight: 600;
    cursor: pointer;
  }

  .view-toggle button:hover {
    color: var(--colour-text);
    background: var(--colour-bg-hover);
  }

  .view-toggle button.active {
    color: white;
    background: linear-gradient(180deg, #4a6ee8, var(--accent-base));
    box-shadow:
      rgba(30, 34, 41, 0.18) 0px 1px 2px,
      rgba(255, 255, 255, 0.14) 0px 1px 0px inset;
  }
</style>
