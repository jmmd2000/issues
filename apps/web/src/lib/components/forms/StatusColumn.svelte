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

  function handleConsider(e: CustomEvent<DndEvent<Status>>) {
    onConsider(e.detail.items);
  }

  function handleFinalize(e: CustomEvent<DndEvent<Status>>) {
    onFinalize(e.detail.items);
  }

  async function handleAdd() {
    if (submitting || !newName.trim()) return;
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
      newName = "";
      adding = false;
    } catch {
      addError = "Network error. Please try again.";
    } finally {
      submitting = false;
    }
  }
</script>

<div class="column">
  <div class="column-header">{label}</div>
  <div class="cards" use:dndzone={{ items: statuses, type: "status", flipDurationMs: 150, dropTargetStyle: {} }} onconsider={handleConsider} onfinalize={handleFinalize}>
    {#each statuses as status (status.id)}
      <StatusRow {status} {projectKey} otherStatuses={allStatuses.filter((s) => s.id !== status.id)} {onUpdate} {onDelete} />
    {/each}
  </div>

  {#if adding}
    <form
      class="add-form"
      novalidate
      onsubmit={(e) => {
        e.preventDefault();
        handleAdd();
      }}
    >
      <input type="text" class="form-input" bind:value={newName} placeholder="Status name..." maxlength="40" required disabled={submitting} />
      <div class="add-actions">
        <button type="submit" class="add-button-primary" disabled={submitting}>{submitting ? "Adding..." : "Add"}</button>
        <button
          type="button"
          class="add-button-secondary"
          onclick={() => {
            adding = false;
            newName = "";
            addError = null;
          }}
          disabled={submitting}>Cancel</button
        >
      </div>
      {#if addError}
        <span class="field-error">{addError}</span>
      {/if}
    </form>
  {:else}
    <button type="button" class="add-trigger" onclick={() => (adding = true)}>
      <Plus size="14" /> Add status
    </button>
  {/if}
</div>

<style>
  .column {
    display: flex;
    flex-direction: column;
    gap: 0.5em;
    padding: 0.75em;
    border: var(--border);
    border-radius: var(--border-radius-outer);
    background-color: var(--colour-bg);
    min-height: 6em;
  }

  .column-header {
    font-size: 0.75em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--colour-muted);
    padding: 0.25em 0.25em 0.5em;
  }

  .cards {
    display: flex;
    flex-direction: column;
    gap: 0.4em;
    min-height: 2em;
  }

  .add-trigger {
    display: flex;
    align-items: center;
    gap: 0.35em;
    padding: 0.4em 0.6em;
    border: 1px dashed var(--colour-border);
    border-radius: var(--border-radius-inner);
    background: transparent;
    color: var(--colour-muted);
    font-size: 0.8em;
    cursor: pointer;
    transition:
      color 0.15s ease,
      border-color 0.15s ease;

    &:hover {
      color: var(--accent-base);
      border-color: var(--accent-base);
    }
  }

  .add-form {
    display: flex;
    flex-direction: column;
    gap: 0.4em;
  }

  .add-actions {
    display: flex;
    gap: 0.4em;
  }

  .add-button-primary {
    padding: 0.4em 0.8em;
    background: var(--accent-base);
    color: white;
    border: none;
    border-radius: var(--border-radius-inner);
    font-size: 0.8em;
    cursor: pointer;

    &[disabled] {
      background: var(--colour-muted);
      cursor: not-allowed;
    }
  }

  .add-button-secondary {
    padding: 0.4em 0.8em;
    background: transparent;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    font-size: 0.8em;
    cursor: pointer;
  }
</style>
