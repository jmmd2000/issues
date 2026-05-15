<script lang="ts">
  import { resolve } from "$app/paths";
  import { Globe2, Lock } from "@lucide/svelte";
  import type { SearchResult } from "@issues/api";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import LabelChip from "$lib/components/tickets/LabelChip.svelte";
  import PriorityChip from "$lib/components/tickets/PriorityChip.svelte";
  import StatusChip from "$lib/components/tickets/StatusChip.svelte";
  import { formatAbsolute, timeAgo } from "$lib/time";
  import HighlightedText from "./HighlightedText.svelte";

  interface SearchResultCardProps {
    ticket: SearchResult;
  }

  let { ticket }: SearchResultCardProps = $props();

  const href = $derived(resolve("/projects/[key]/tickets/[num]", { key: ticket.project.key, num: String(ticket.number) }));
  const key = $derived(`${ticket.project.key}-${ticket.number}`);
  const descriptionParts = $derived(ticket.highlights.description.length > 0 ? ticket.highlights.description : ticket.description.trim() ? [{ text: ticket.description, highlighted: false }] : []);
  const hasDescription = $derived(descriptionParts.length > 0);
  const updatedText = $derived(timeAgo(ticket.updatedAt));
  const updatedTitle = $derived(formatAbsolute(ticket.updatedAt));
  const VisibilityIcon = $derived(ticket.visibility === "public" && ticket.project.visibility === "public" ? Globe2 : Lock);
  const visibilityLabel = $derived(ticket.visibility === "public" && ticket.project.visibility === "public" ? "Public" : "Private");
</script>

<a class="result-card" {href} aria-label={`${key}: ${ticket.title}`}>
  <div class="result-topline">
    <code class="ticket-key">{key}</code>
    <StatusChip name={ticket.status.name} category={ticket.status.category} />
    <PriorityChip priority={ticket.priority} />
    <span class="visibility" title={visibilityLabel} aria-label={visibilityLabel}>
      <VisibilityIcon size={12} strokeWidth={2.5} />
    </span>
  </div>

  <h2>
    <HighlightedText parts={ticket.highlights.title} fallback={ticket.title} />
  </h2>

  {#if hasDescription}
    <p class="description">
      <HighlightedText parts={descriptionParts} />
    </p>
  {:else}
    <p class="description muted">No description.</p>
  {/if}

  <div class="result-footer">
    <div class="project">
      <code class="project-key">{ticket.project.key}</code>
      <span>{ticket.project.name}</span>
    </div>

    {#if ticket.labels.length > 0}
      <div class="labels" aria-label="Labels">
        {#each ticket.labels as label (label.id)}
          <LabelChip name={label.name} colour={label.colour} />
        {/each}
      </div>
    {/if}

    <div class="meta">
      {#if ticket.assignee}
        <span class="assignee" title={`Assigned to ${ticket.assignee.name}`}>
          <UserAvatar name={ticket.assignee.name} avatarURL={ticket.assignee.avatarURL} size="sm" />
          <span>{ticket.assignee.name}</span>
        </span>
      {/if}
      <time datetime={ticket.updatedAt} title={updatedTitle}>Updated {updatedText}</time>
    </div>
  </div>
</a>

<style>
  .result-card {
    display: grid;
    gap: 0.65rem;
    padding: 0.95rem 1rem;
    border: var(--border);
    border-radius: var(--border-radius-outer);
    background: var(--colour-bg-lighter);
    color: inherit;
    text-decoration: none;
    box-shadow: var(--box-shadow);
    transition:
      border-color var(--motion-fast) var(--ease-out-quart),
      background var(--motion-fast) var(--ease-out-quart),
      transform 60ms var(--ease-out-quart);

    &:hover {
      border-color: color-mix(in oklch, var(--accent-base) 35%, var(--colour-border) 65%);
      background: color-mix(in oklch, var(--colour-bg-lighter) 88%, var(--accent-tint-900) 12%);
    }

    &:active {
      transform: translateY(1px);
    }
  }

  .result-topline {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
    flex-wrap: wrap;
  }

  .ticket-key,
  .project-key {
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--accent-base);
  }

  .ticket-key {
    font-size: 0.75rem;
    letter-spacing: 0.03em;
  }

  .visibility {
    display: inline-grid;
    place-items: center;
    width: 1.4rem;
    height: 1.4rem;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    color: var(--colour-muted);
    background: var(--colour-bg);
  }

  h2 {
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.25;
    color: var(--colour-text);
  }

  .description {
    display: -webkit-box;
    line-clamp: 3;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    max-width: 74ch;
    overflow: hidden;
    color: var(--colour-text-secondary);
    font-size: 0.85rem;
    line-height: 1.45;
  }

  .description.muted {
    color: var(--colour-muted);
    font-style: italic;
  }

  .result-footer {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    min-width: 0;
    flex-wrap: wrap;
    padding-top: 0.1rem;
  }

  .project {
    display: inline-flex;
    align-items: baseline;
    gap: 0.4rem;
    min-width: 0;
    color: var(--colour-text-secondary);
    font-size: 0.75rem;

    span:last-child {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .project-key {
    font-size: 0.7rem;
  }

  .labels {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-width: 0;
    flex-wrap: wrap;
  }

  .meta {
    display: inline-flex;
    align-items: center;
    gap: 0.65rem;
    margin-left: auto;
    color: var(--colour-muted);
    font-size: 0.75rem;
  }

  .assignee {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-width: 0;
    color: var(--colour-text-secondary);
  }

  time {
    white-space: nowrap;
  }

  @media (max-width: 720px) {
    .result-card {
      padding: 0.85rem;
    }

    .meta {
      width: 100%;
      margin-left: 0;
      justify-content: space-between;
    }
  }
</style>
