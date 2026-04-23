<script lang="ts">
  import { client } from "$lib/api/client";
  import type { Status } from "@issues/api";
  import { Check, GripVertical, Trash2 } from "@lucide/svelte";
  import { onDestroy } from "svelte";
  import { fade } from "svelte/transition";
  import Button from "$lib/components/ui/Button.svelte";

  let {
    status,
    projectKey,
    otherStatuses,
    onUpdate,
    onDelete,
  }: {
    status: Status;
    projectKey: string;
    otherStatuses: Status[];
    onUpdate: (status: Status) => void;
    onDelete: (id: string) => void;
  } = $props();
  // svelte-ignore state_referenced_locally
  let form = $state({ name: status.name });
  // svelte-ignore state_referenced_locally
  let lastSaved = $state({ name: status.name });
  let fieldErrors: Record<string, string> = $state({});
  let networkError = $state<string | null>(null);
  let justSaved = $state(false);
  let submitting = $state(false);

  let confirming = $state(false);
  // svelte-ignore state_referenced_locally
  let reassignTo = $state(otherStatuses[0]?.id ?? "");
  let deleting = $state(false);

  let savedTimer: ReturnType<typeof setTimeout> | null = null;
  onDestroy(() => {
    if (savedTimer) clearTimeout(savedTimer);
  });

  async function handleSubmit() {
    if (deleting || submitting) return;
    if (form.name.trim() === lastSaved.name.trim()) return;

    submitting = true;
    fieldErrors = {};
    networkError = null;
    try {
      const res = await client.api.projects[":key"].statuses[":id"].$patch({
        param: { key: projectKey, id: status.id },
        json: { name: form.name },
      });

      if (!res.ok) {
        const data = (await res.json()) as { message?: string; fieldErrors?: Record<string, string> };
        fieldErrors = data.fieldErrors ?? {};
        if (Object.keys(fieldErrors).length === 0) {
          networkError = data.message ?? "Failed to save changes";
        }
        return;
      }

      const data = (await res.json()) as { status: Status };
      lastSaved = { name: data.status.name };
      onUpdate(data.status);
      justSaved = true;
      if (savedTimer) clearTimeout(savedTimer);
      savedTimer = setTimeout(() => (justSaved = false), 2000);
    } catch {
      networkError = "Network error. Please try again.";
    } finally {
      submitting = false;
    }
  }

  async function confirmDelete() {
    if (deleting || !reassignTo) return;
    deleting = true;
    networkError = null;
    try {
      const res = await client.api.projects[":key"].statuses[":id"].$delete({
        param: { key: projectKey, id: status.id },
        json: { reassignTo },
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        networkError = data.message ?? "Failed to delete.";
        return;
      }
      onDelete(status.id);
    } catch {
      networkError = "Failed to delete. Please try again.";
    } finally {
      deleting = false;
    }
  }
</script>

<form
  class="status-card"
  novalidate
  onsubmit={(e) => {
    e.preventDefault();
    handleSubmit();
  }}
>
  <div class="row">
    <span class="drag-handle" aria-hidden="true">
      <GripVertical size="14" />
    </span>
    <input
      type="text"
      class="form-input row-name"
      bind:value={form.name}
      placeholder="Status name..."
      required
      maxLength="40"
      onchange={handleSubmit}
      onblur={handleSubmit}
      disabled={submitting || deleting}
    />
    {#if justSaved}
      <span class="row-status" data-type="success" transition:fade={{ duration: 300 }}>
        <Check size="14" />
      </span>
    {/if}
    <button
      type="button"
      class="delete-button"
      onclick={() => (confirming = !confirming)}
      disabled={submitting || deleting || otherStatuses.length === 0}
      title={otherStatuses.length === 0 ? "Cannot delete the only status" : "Delete"}
    >
      <Trash2 size="14" color="var(--colour-error)" />
    </button>
  </div>

  {#if confirming}
    <div class="confirm">
      <label class="form-label" for="reassign-{status.id}">Move existing tickets to:</label>
      <select id="reassign-{status.id}" class="form-input" bind:value={reassignTo} disabled={deleting}>
        {#each otherStatuses as opt (opt.id)}
          <option value={opt.id}>{opt.name}</option>
        {/each}
      </select>
      <div class="confirm-actions">
        <Button type="button" variant="danger" size="sm" onclick={confirmDelete} disabled={deleting}>
          {deleting ? "Deleting..." : "Confirm delete"}
        </Button>
        <Button type="button" variant="secondary" size="sm" onclick={() => (confirming = false)} disabled={deleting}>Cancel</Button>
      </div>
    </div>
  {/if}

  {#if networkError}
    <span class="row-status" data-type="error">{networkError}</span>
  {/if}
  {#if fieldErrors.name}
    <span class="field-error">{fieldErrors.name}</span>
  {/if}
</form>

<style>
  .status-card {
    display: flex;
    flex-direction: column;
    gap: 0.4em;
    padding: 0.5em 0.6em;
    background: var(--colour-bg-lighter);
    border: var(--border);
    border-radius: var(--border-radius-inner);
    box-shadow: var(--box-shadow);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 0.4em;
  }

  .drag-handle {
    cursor: grab;
    color: var(--colour-muted);
    display: flex;
    align-items: center;
  }

  .row-name {
    flex: 1;
    min-width: 0;
    font-size: 0.875em;
  }

  .row-status {
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    gap: 0.25em;
  }

  .row-status[data-type="error"] {
    color: var(--colour-error);
    background-color: var(--colour-error-bg);
    border: var(--border);
    border-color: var(--colour-error-border);
    border-radius: var(--border-radius-inner);
    padding: 0.3em 0.5em;
  }

  .row-status[data-type="success"] {
    color: var(--colour-success);
  }

  .delete-button {
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--colour-error-bg);
    border: var(--border);
    border-color: var(--colour-error-border);
    padding: 0.3em 0.45em;
    border-radius: var(--border-radius-inner);
    cursor: pointer;

    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
    &:hover:not(:disabled) {
      background-color: var(--colour-error-bg-hover);
    }
  }

  .confirm {
    display: flex;
    flex-direction: column;
    gap: 0.4em;
    padding: 0.5em;
    background: var(--colour-bg);
    border: var(--border);
    border-radius: var(--border-radius-inner);
  }

  .confirm-actions {
    display: flex;
    gap: 0.4em;
  }
</style>
