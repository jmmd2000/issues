<script lang="ts">
  import { Plus, X } from "@lucide/svelte";
  import type { TicketLink } from "@issues/api";
  import Button from "$lib/components/ui/Button.svelte";
  import { client } from "$lib/api/client";
  import { LINK_OPTIONS, linkLabel } from "$lib/linkLabels";
  import TicketSearchCombobox, { type TicketRef } from "./TicketSearchCombobox.svelte";
  import TicketRow from "./TicketRow.svelte";

  interface TicketLinksProps {
    links: TicketLink[];
    projectKey: string;
    ticketNumber: number;
    onmutated: () => void | Promise<void>;
  }

  let { links, projectKey, ticketNumber, onmutated }: TicketLinksProps = $props();

  let adding = $state(false);
  let optionKey = $state<string>(LINK_OPTIONS[0].key);
  let selected = $state<TicketRef | null>(null);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let deletingID = $state<string | null>(null);

  const selectedOption = $derived(LINK_OPTIONS.find((option) => option.key === optionKey) ?? LINK_OPTIONS[0]);

  // Group links by their rendered label so the sidebar reads like:
  //   blocks
  //     KEY-12 ...
  //   is blocked by
  //     KEY-7 ...
  type Group = { label: string; entries: TicketLink[] };
  const grouped = $derived.by((): Group[] => {
    const buckets = new Map<string, TicketLink[]>();
    for (const link of links) {
      const label = linkLabel(link.linkType, link.direction);
      const list = buckets.get(label) ?? [];
      list.push(link);
      buckets.set(label, list);
    }
    return [...buckets.entries()].map(([label, entries]) => ({ label, entries }));
  });

  function startAdding() {
    adding = true;
    error = null;
    selected = null;
    optionKey = LINK_OPTIONS[0].key;
  }

  function cancelAdding() {
    adding = false;
    selected = null;
    error = null;
  }

  async function addLink() {
    if (!selected || saving) return;

    saving = true;
    error = null;
    try {
      const res = await client.api.projects[":key"].tickets[":num"].links.$post({
        param: { key: projectKey, num: String(ticketNumber) },
        json: { targetRef: `${projectKey}-${selected.number}`, linkType: selectedOption.linkType, direction: selectedOption.direction },
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        error = data.message ?? "Failed to add link.";
        return;
      }

      cancelAdding();
      await onmutated();
    } finally {
      saving = false;
    }
  }

  async function removeLink(link: TicketLink) {
    if (deletingID) return;
    deletingID = link.id;
    try {
      const res = await client.api.projects[":key"].tickets[":num"].links[":id"].$delete({
        param: { key: projectKey, num: String(ticketNumber), id: link.id },
      });
      if (!res.ok) return;
      await onmutated();
    } finally {
      deletingID = null;
    }
  }
</script>

<section class="links-card card" aria-label="Links">
  <header class="header">
    <h2>Links</h2>
    <button type="button" class="add-trigger" onclick={startAdding} aria-label="Add link" disabled={adding}>
      <Plus size={14} strokeWidth={3} />
    </button>
  </header>

  {#if adding}
    <form
      class="add-form"
      onsubmit={(event) => {
        event.preventDefault();
        void addLink();
      }}
    >
      <select bind:value={optionKey} disabled={saving} class="link-type-select" aria-label="Link type">
        {#each LINK_OPTIONS as option (option.key)}
          <option value={option.key}>{option.label}</option>
        {/each}
      </select>

      <TicketSearchCombobox
        {projectKey}
        excludeTicketNumber={ticketNumber}
        includeClosed
        placeholder="Search tickets..."
        disabled={saving}
        selected={selected}
        onpicked={(ticket) => (selected = ticket)}
        oncleared={() => (selected = null)}
      />

      {#if error}
        <p class="error" role="alert">{error}</p>
      {/if}
      <div class="form-actions">
        <Button type="button" variant="secondary" size="sm" onclick={cancelAdding} disabled={saving}>Cancel</Button>
        <Button type="submit" size="sm" disabled={saving || !selected}>{saving ? "Adding..." : "Add"}</Button>
      </div>
    </form>
  {/if}

  {#if grouped.length === 0 && !adding}
    <p class="empty">No links.</p>
  {:else}
    <div class="groups">
      {#each grouped as group (group.label)}
        <div class="group">
          <h3 class="group-label">{group.label}</h3>
          <ul class="group-list">
            {#each group.entries as link (link.id)}
              <li>
                <TicketRow
                  ticket={{ id: link.ticket.id, number: link.ticket.number, title: link.ticket.title, projectKey: link.ticket.projectKey }}
                  status={link.ticket.status}
                  priority={link.ticket.priority}
                  assignee={link.ticket.assignee}
                >
                  {#snippet trailing()}
                    {#if link.linkType !== "clones"}
                      <button
                        type="button"
                        class="remove"
                        onclick={() => void removeLink(link)}
                        disabled={deletingID === link.id}
                        aria-label={`Remove ${linkLabel(link.linkType, link.direction)} ${link.ticket.projectKey}-${link.ticket.number}`}
                      >
                        <X size={12} strokeWidth={2} />
                      </button>
                    {/if}
                  {/snippet}
                </TicketRow>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .links-card {
    padding: 0.85rem;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.7rem;

    & h2 {
      color: var(--colour-text);
      font-size: 0.8rem;
      font-weight: 800;
    }
  }

  .add-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.4rem;
    height: 1.4rem;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg);
    color: var(--colour-muted);
    cursor: pointer;

    &:hover:not(:disabled) {
      color: var(--accent-base);
      border-color: var(--accent-tint-600);
      background: var(--accent-tint-900);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .empty {
    margin: 0;
    color: var(--colour-muted);
    font-size: 0.8rem;
    font-style: italic;
  }

  .groups {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .group-label {
    color: var(--colour-muted);
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.3rem;
  }

  .group-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.2rem;
    height: 1.2rem;
    border: 0;
    background: transparent;
    color: var(--colour-muted);
    border-radius: var(--border-radius-inner);
    cursor: pointer;
    opacity: 0;
    transition: opacity 120ms ease;

    &:hover {
      color: var(--colour-error);
      background: var(--colour-bg-lighter);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  .group-list li:hover .remove,
  .remove:focus-visible {
    opacity: 1;
  }

  .add-form {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.5rem;
    margin-bottom: 0.7rem;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg);
  }

  .link-type-select {
    width: 100%;
    padding: 0.35rem 0.45rem;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg-lighter);
    color: var(--colour-text);
    font: inherit;
    font-size: 0.8rem;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.4rem;
  }

  .error {
    margin: 0;
    color: var(--colour-error);
    font-size: 0.75rem;
  }
</style>
