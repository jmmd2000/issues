<script lang="ts">
  import { client } from "$lib/api/client";
  import type { LabelWithCount } from "@issues/api";
  import { Check, Trash2 } from "@lucide/svelte";
  import { onDestroy } from "svelte";
  import { fade } from "svelte/transition";
  import { deleteLabelWarning } from "$lib/labels";
  import Button from "$lib/components/ui/Button.svelte";
  import LabelChip from "$lib/components/tickets/LabelChip.svelte";
  import ColourPicker from "./ColourPicker.svelte";

  let { label, projectKey, onDelete, onUpdate }: { label: LabelWithCount; projectKey: string; onDelete: (labelID: string) => void; onUpdate: (label: LabelWithCount) => void } = $props();

  // svelte-ignore state_referenced_locally
  const form = $state({ name: label.name, colour: label.colour });
  // svelte-ignore state_referenced_locally
  let lastSaved = $state({ name: label.name, colour: label.colour });
  let fieldErrors: Record<string, string> = $state({});
  let networkError = $state<string | null>(null);
  let justSaved = $state(false);
  let submitting = $state(false);
  let deleting = $state(false);
  let confirming = $state(false);
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
      const data = (await res.json()) as { label: LabelWithCount };
      lastSaved = { name: data.label.name, colour: data.label.colour };
      onUpdate({ ...data.label, ticketCount: label.ticketCount });
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
    confirming = true;
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
        confirming = false;
        return;
      }

      onDelete(label.id);
    } catch {
      networkError = "Failed to delete. Please try again.";
      confirming = false;
    } finally {
      deleting = false;
    }
  }
</script>

<form
  class="label-row"
  novalidate
  onsubmit={e => {
    e.preventDefault();
    void handleSubmit();
  }}
>
  <ColourPicker bind:value={form.colour} ariaLabel={`Colour for ${lastSaved.name}`} disabled={submitting || deleting} onchange={() => void handleSubmit()} />
  <input
    type="text"
    id="label-{label.id}-name"
    class="form-input row-name"
    aria-label="Label name"
    bind:value={form.name}
    placeholder="Label name"
    required
    maxlength="25"
    aria-invalid={fieldErrors.name ? "true" : undefined}
    onchange={handleSubmit}
    onblur={handleSubmit}
    disabled={submitting || deleting}
  />
  <span class="preview"><LabelChip name={form.name.trim() || "Label"} colour={form.colour} /></span>

  {#if networkError}
    <span class="row-status" data-type="error">{networkError}</span>
  {:else if justSaved}
    <span class="row-status" data-type="success" transition:fade={{ duration: 300 }}>
      <Check size="14" />
      Saved
    </span>
  {/if}

  {#if confirming}
    <span class="confirm">
      <span>Delete {lastSaved.name}? {deleteLabelWarning(label.ticketCount)}</span>
      <Button type="button" variant="danger" size="sm" disabled={deleting} onclick={() => void confirmDelete()}>{deleting ? "Deleting..." : "Delete"}</Button>
      <Button type="button" variant="secondary" size="sm" disabled={deleting} onclick={() => (confirming = false)}>Cancel</Button>
    </span>
  {:else}
    <button type="button" class="delete-button" aria-label={`Delete label ${lastSaved.name}`} onclick={requestDelete} disabled={submitting || deleting}>
      <Trash2 size="15" />
    </button>
  {/if}
</form>
{#if fieldErrors.colour || fieldErrors.name}
  <div class="field-errors">
    {#if fieldErrors.colour}<span id="label-{label.id}-colour-error" class="field-error">{fieldErrors.colour}</span>{/if}
    {#if fieldErrors.name}<span id="label-{label.id}-name-error" class="field-error">{fieldErrors.name}</span>{/if}
  </div>
{/if}

<style>
  .label-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }

  .row-name {
    flex: 1 1 10rem;
    min-width: 0;
    max-width: 16rem;
  }

  .preview {
    min-width: 0;
    flex: 0 1 auto;
  }

  .row-status {
    display: flex;
    align-items: center;
    gap: 0.25em;
    font-size: 0.875rem;

    &[data-type="error"] {
      padding: 0.4em 0.6em;
      border: 1px solid var(--colour-error-border);
      border-radius: var(--border-radius-inner);
      background-color: var(--colour-error-bg);
      color: var(--colour-error);
    }

    &[data-type="success"] {
      color: var(--colour-success);
    }
  }

  .delete-button {
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    margin-left: auto;
    padding: 0;
    border: 0;
    border-radius: var(--border-radius-inner);
    background: transparent;
    color: var(--colour-muted);
    cursor: pointer;
    opacity: 0;
    transition:
      opacity var(--motion-fast) var(--ease-out-quart),
      background var(--motion-fast) var(--ease-out-quart),
      color var(--motion-fast) var(--ease-out-quart);

    &:hover {
      background: var(--colour-error-bg);
      color: var(--colour-error);
    }

    &:disabled {
      cursor: not-allowed;
    }
  }

  .label-row:hover .delete-button,
  .label-row:focus-within .delete-button,
  .delete-button:focus-visible {
    opacity: 1;
  }

  @media (hover: none) {
    .delete-button {
      opacity: 1;
    }
  }

  .confirm {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-left: auto;
    font-size: 0.875rem;
  }
</style>
