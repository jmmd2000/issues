<script lang="ts">
  import { resolve } from "$app/paths";
  import type { Snippet } from "svelte";
  import type { Priority, Status } from "@issues/api";
  import StatusChip from "./StatusChip.svelte";
  import PriorityChip from "./PriorityChip.svelte";
  import UserAvatar from "$lib/components/UserAvatar.svelte";

  interface TicketRowProps {
    ticket: { id: string; number: number; title: string; projectKey: string };
    status: { name: string; category: Status["category"] };
    priority?: Priority;
    assignee?: { name: string; avatarURL: string | null } | null;
    /** Optional trailing content rendered after the row (remove buttons, menus, etc.). */
    trailing?: Snippet;
    /** When provided, the row body becomes a button that calls this handler. Otherwise it renders as a link to the ticket detail page. */
    onclick?: () => void;
  }

  let { ticket, status, priority, assignee, trailing, onclick }: TicketRowProps = $props();

  const href = $derived(resolve("/projects/[key]/tickets/[num]", { key: ticket.projectKey, num: String(ticket.number) }));
</script>

{#snippet body()}
  <StatusChip name={status.name} category={status.category} />
  <span class="key">{ticket.projectKey}-{ticket.number}</span>
  <span class="title">{ticket.title}</span>
  {#if priority}
    <PriorityChip {priority} />
  {/if}
  {#if assignee}
    <span class="assignee" title={assignee.name}>
      <UserAvatar name={assignee.name} avatarURL={assignee.avatarURL} size="sm" />
    </span>
  {/if}
{/snippet}

<div class="ticket-row">
  {#if onclick}
    <button type="button" class="ticket-target as-button" {onclick} title={ticket.title}>
      {@render body()}
    </button>
  {:else}
    <a class="ticket-target" {href} title={ticket.title}>
      {@render body()}
    </a>
  {/if}
  {#if trailing}
    <div class="trailing">{@render trailing()}</div>
  {/if}
</div>

<style>
  .ticket-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
    padding: 0.3rem 0.4rem;
    border-radius: var(--border-radius-inner);

    &:hover {
      background: var(--colour-bg);
    }
  }

  .ticket-target {
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 0.55rem;
    flex: 1;
    min-width: 0;
    text-decoration: none;
    color: inherit;

    &:hover .title {
      text-decoration: underline;
    }
  }

  .ticket-target.as-button {
    border: 0;
    background: transparent;
    padding: 0;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .key {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--accent-base);
    white-space: nowrap;
  }

  .title {
    font-size: 0.8rem;
    color: var(--colour-text);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .assignee {
    display: inline-flex;
    align-items: center;
    line-height: 1;
  }

  .trailing {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
  }
</style>
