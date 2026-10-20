<script lang="ts">
  import type { Status } from "@issues/api";
  import { dndzone, type DndEvent } from "svelte-dnd-action";
  import { Plus } from "@lucide/svelte";
  import { client } from "$lib/api/client";
  import StatusRow from "./StatusRow.svelte";

  type Category = Status["category"];

  let {
    category,
    label,
    statuses,
    allStatuses,
    projectKey,
    onConsider,
    onFinalize,
    onUpdate,
    onDelete,
    onAdd,
  }: {
    category: Category;
    label: string;
    statuses: Status[];
    allStatuses: Status[];
    projectKey: string;
    onConsider: (items: Status[]) => void;
    onFinalize: (items: Status[]) => void;
    onUpdate: (status: Status) => void;
    onDelete: (id: string) => void;
    onAdd: (status: Status) => void;
  } = $props();

  let adding = $state(false);
  let newName = $state("");
  let addError = $state<string | null>(null);
  let submitting = $state(false);
  let newInput: HTMLInputElement | null = $state(null);

  $effect(() => {
    if (adding) newInput?.focus();
  });

  function handleConsider(e: CustomEvent<DndEvent<Status>>) {
    onConsider(e.detail.items);
  }

  function handleFinalize(e: CustomEvent<DndEvent<Status>>) {
    onFinalize(e.detail.items);
  }

  function cancelAdd() {
    adding = false;
    newName = "";
    addError = null;
  }

  async function handleAdd() {
    if (submitting) return;
    if (!newName.trim()) {
      cancelAdd();
      return;
    }

    submitting = true;
    addError = null;
    try {
      const res = await client.api.projects[":key"].statuses.$post({
        param: { key: projectKey },
        json: { name: newName.trim(), category },
      });

      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        addError = data.message ?? "Failed to add status.";
        return;
      }

      const data = (await res.json()) as { status: Status };
      onAdd(data.status);
      cancelAdd();
    } catch {
      addError = "Network error. Please try again.";
    } finally {
      submitting = false;
    }
  }
</script>

<section class="group" data-category={category} aria-label={label}>
  <h3 class="group-head">
    <span class="dot" aria-hidden="true"></span>
    <span class="group-name">{label}</span>
    <span class="count">{statuses.length}</span>
  </h3>

  <div class="rows" use:dndzone={{ items: statuses, type: "status", flipDurationMs: 150, dropTargetStyle: {} }} onconsider={handleConsider} onfinalize={handleFinalize}>
    {#each statuses as status (status.id)}
      <StatusRow {status} {projectKey} otherStatuses={allStatuses.filter(s => s.id !== status.id)} {onUpdate} {onDelete} />
    {/each}
  </div>

  {#if adding}
    <form
      class="add-form"
      novalidate
      onsubmit={e => {
        e.preventDefault();
        void handleAdd();
      }}
    >
      <input
        bind:this={newInput}
        type="text"
        class="form-input add-input"
        aria-label="New {label} status name"
        bind:value={newName}
        placeholder="Status name"
        maxlength="40"
        disabled={submitting}
        aria-invalid={addError ? "true" : undefined}
        onkeydown={event => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            cancelAdd();
          }
        }}
        onblur={() => {
          if (!newName.trim() && !submitting) cancelAdd();
        }}
      />
      {#if addError}<span class="field-error">{addError}</span>{/if}
    </form>
  {:else}
    <button type="button" class="add-trigger" onclick={() => (adding = true)}>
      <Plus size="13" /> Add status
    </button>
  {/if}
</section>

<style>
  .group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
    min-height: 6rem;
    padding: 0.75rem;
    background: var(--colour-bg-lighter);

    --dot: var(--colour-status-backlog);

    &[data-category="active"] {
      --dot: var(--colour-status-active);
    }

    &[data-category="done"] {
      --dot: var(--colour-status-done);
    }

    &[data-category="cancelled"] {
      --dot: var(--colour-status-cancelled);
    }
  }

  .group-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 0 0.25rem;
    padding: 0 0.25rem;
    font-size: 0.8125rem;
    font-weight: 600;
  }

  .dot {
    flex: none;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--dot);
  }

  .count {
    margin-left: auto;
    color: var(--colour-muted);
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    font-weight: 500;
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-height: 2rem;
  }

  .add-trigger {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    align-self: flex-start;
    margin-top: 0.25rem;
    padding: 0.25rem 0.5rem;
    border: 0;
    border-radius: var(--border-radius-inner);
    background: transparent;
    color: var(--colour-muted);
    font: inherit;
    font-size: 0.8125rem;
    cursor: pointer;

    &:hover {
      background: var(--colour-bg-hover);
      color: var(--colour-text);
    }
  }

  .add-form {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-top: 0.25rem;
    padding-left: 1.25rem;
  }

  .add-input {
    font-size: 0.875em;
  }
</style>
