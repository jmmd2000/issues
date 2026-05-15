<script lang="ts">
  import { client } from "$lib/api/client";
  import type { Label } from "@issues/api";
  import { Check, Trash2 } from "@lucide/svelte";
  import { onDestroy } from "svelte";
  import { fade } from "svelte/transition";
  import Button from "$lib/components/ui/Button.svelte";
  import Modal from "$lib/components/ui/Modal.svelte";

  let { label, projectKey, onDelete, onUpdate }: { label: Label; projectKey: string; onDelete: (labelID: string) => void; onUpdate: (label: Label) => void } = $props();

  // svelte-ignore state_referenced_locally
  let form = $state({ name: label.name, colour: label.colour });
  // svelte-ignore state_referenced_locally
  let lastSaved = $state({ name: label.name, colour: label.colour });
  let fieldErrors: Record<string, string> = $state({});
  let networkError = $state<string | null>(null);
  let justSaved = $state(false);
  let submitting = $state(false);
  let deleting = $state(false);
  let confirmOpen = $state(false);
  let savedTimer: ReturnType<typeof setTimeout> | null = null;

  onDestroy(() => {
    if (savedTimer) clearTimeout(savedTimer);
  });

  async function handleSubmit() {
    if (deleting) return;
    if (form.name.trim() === lastSaved.name.trim() && form.colour === lastSaved.colour) return;
    if (submitting) return;

    submitting = true;
    fieldErrors = {};
    networkError = null;
    try {
      const res = await client.api.projects[":key"].labels[":id"].$patch({
        param: { key: projectKey, id: label.id },
        json: {
          name: form.name,
          colour: form.colour,
        },
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string; fieldErrors?: Record<string, string> };
        fieldErrors = data.fieldErrors ?? {};
        if (Object.keys(fieldErrors).length === 0) {
          networkError = data.message ?? "Failed to save changes";
        }
        return;
      }
      const data = (await res.json()) as { label: Label };
      lastSaved = { name: data.label.name, colour: data.label.colour };
      onUpdate(data.label);
      justSaved = true;
      if (savedTimer) clearTimeout(savedTimer);
      savedTimer = setTimeout(() => {
        justSaved = false;
      }, 2000);
    } catch {
      networkError = "Network error. Please try again.";
    } finally {
      submitting = false;
    }
  }

  function requestDelete() {
    if (submitting || deleting) return;
    networkError = null;
    confirmOpen = true;
  }

  async function confirmDelete() {
    if (submitting || deleting) return;

    deleting = true;
    try {
      const res = await client.api.projects[":key"].labels[":id"].$delete({
        param: { key: projectKey, id: label.id },
      });

      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        networkError = data.message ?? "Failed to delete. Please try again.";
        confirmOpen = false;
        return;
      }

      onDelete(label.id);
    } catch {
      networkError = "Failed to delete. Please try again.";
      confirmOpen = false;
    } finally {
      deleting = false;
    }
  }
</script>

<form
  novalidate
  onsubmit={(e) => {
    e.preventDefault();
    handleSubmit();
  }}
>
  <div class="label-row">
    <label class="form-colour-picker">
      <span class="form-colour-picker-swatch" style:background-color={form.colour}></span>
      <input type="color" id="label-{label.id}-colour" aria-label="Choose label colour" bind:value={form.colour} onchange={handleSubmit} disabled={submitting || deleting} />
    </label>
    <input
      type="text"
      id="label-{label.id}-name"
      class="form-input row-name"
      bind:value={form.name}
      placeholder="Enter label name..."
      required
      maxlength="25"
      onchange={handleSubmit}
      onblur={handleSubmit}
      disabled={submitting || deleting}
    />
    {#if networkError}
      <span class="row-status" data-type="error">{networkError}</span>
    {:else if justSaved}
      <span class="row-status" data-type="success" transition:fade={{ duration: 300 }}>
        <Check size="14" />
        Saved
      </span>
    {/if}
    <button type="button" class="delete-button" aria-label={`Delete label ${form.name}`} onclick={requestDelete} disabled={submitting || deleting}>
      <Trash2 size="16" color="var(--colour-error)" />
    </button>
  </div>
  <div class="field-errors">
    {#if fieldErrors.colour}
      <span id="label-{label.id}-colour-error" class="field-error">{fieldErrors.colour}</span>
    {/if}
    {#if fieldErrors.name}
      <span id="label-{label.id}-name-error" class="field-error">{fieldErrors.name}</span>
    {/if}
  </div>
</form>

<Modal open={confirmOpen} title={`Delete "${lastSaved.name}"?`} onclose={() => (confirmOpen = false)} maxWidth="28rem">
  <p class="confirm-body">
    Remove the <strong>{lastSaved.name}</strong> label from this project. Tickets currently tagged with it will lose the tag.
  </p>
  {#snippet footer()}
    <Button type="button" variant="secondary" onclick={() => (confirmOpen = false)} disabled={deleting}>Cancel</Button>
    <Button type="button" variant="danger" onclick={() => void confirmDelete()} disabled={deleting}>
      {deleting ? "Deleting..." : "Delete label"}
    </Button>
  {/snippet}
</Modal>

<style>
  .label-row {
    display: flex;
    align-items: center;
    gap: 0.75em;
  }

  .row-name {
    flex: 1;
    min-width: 0;
  }

  .row-status {
    font-size: 0.875rem;
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
    padding: 0.4em 0.6em;
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
    padding: 0.4em 0.6em;
    height: 2em;
    margin: 0;
    border-radius: var(--border-radius-inner);
    transition: background-color var(--motion-fast) var(--ease-out-quart);
    cursor: pointer;

    &:hover {
      background-color: var(--colour-error-bg-hover);
    }

    &:focus {
      outline: 2px solid var(--colour-error);
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.7;
    }
  }

  .confirm-body {
    margin: 0;
    color: var(--colour-text);
    font-size: 0.9rem;
    line-height: 1.5;
  }
</style>
