<script lang="ts">
  import { ChevronRight } from "@lucide/svelte";
  import type { ActivityLookup, GlobalActivity } from "@issues/api";
  import { groupFeed } from "$lib/activityGroups";
  import { timeAgo } from "$lib/time";
  import ProjectActivityCard from "$lib/components/projectDetail/ProjectActivityCard.svelte";

  let { events, lookups }: { events: GlobalActivity[]; lookups: Record<string, ActivityLookup> } = $props();

  const groups = $derived(groupFeed(events));
</script>

{#snippet card(event: GlobalActivity)}
  {@const lookup = lookups[event.project.key]}
  <ProjectActivityCard
    row={event}
    projectKey={event.project.key}
    isLocked={event.project.isLocked}
    statuses={lookup?.statuses ?? []}
    labels={lookup?.labels ?? []}
    members={lookup?.members ?? []}
    showTitle
  />
{/snippet}

<div class="feed">
  {#each groups as group (group.id)}
    <details class="group" open={group.open}>
      <summary>
        <ChevronRight size={12} strokeWidth={2.5} class="chevron" />
        <span class="day">{group.label}</span>
        <span class="count">{group.count}</span>
      </summary>
      <ul class="entries">
        {#each group.entries as entry (entry.kind === "single" ? entry.event.id : entry.events[0].id)}
          {#if entry.kind === "single"}
            {@render card(entry.event)}
          {:else}
            <li class="run">
              <details>
                <summary>
                  <ChevronRight size={12} strokeWidth={2.5} class="chevron" />
                  <span class="run-label">{entry.label}</span>
                  <time datetime={entry.events[0].createdAt}>{timeAgo(entry.events[0].createdAt)}</time>
                </summary>
                <ul class="entries nested">
                  {#each entry.events as event (event.id)}
                    {@render card(event)}
                  {/each}
                </ul>
              </details>
            </li>
          {/if}
        {/each}
      </ul>
    </details>
  {/each}
</div>

<style>
  .feed {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  summary {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
    list-style: none;
    user-select: none;

    &::-webkit-details-marker {
      display: none;
    }

    & :global(.chevron) {
      flex: none;
      color: var(--colour-muted);
      transition: transform var(--motion-fast) var(--ease-out-quart);
    }
  }

  details[open] > summary :global(.chevron) {
    transform: rotate(90deg);
  }

  .group > summary {
    padding: 0.25rem 0;
    color: var(--colour-muted);
    font-size: 0.7em;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .count {
    padding: 0 0.4em;
    border-radius: 999px;
    background: var(--colour-bg-hover);
    font-size: 0.95em;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0;
  }

  .entries {
    display: flex;
    flex-direction: column;
    gap: 0.55em;
    margin: 0.4rem 0 0.5rem;
    padding: 0;
    list-style: none;
  }

  .run {
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg-lighter);

    & > details > summary {
      padding: 0.6rem 0.8rem;
      color: var(--colour-text-secondary);
      font-size: 0.85em;
    }

    & time {
      margin-left: auto;
      color: var(--colour-muted);
      font-size: 0.9em;
      white-space: nowrap;
    }
  }

  .run-label {
    font-weight: 600;
  }

  .nested {
    margin: 0;
    padding: 0 0.5rem 0.5rem;
  }
</style>
