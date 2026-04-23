<script lang="ts">
  import { client } from "$lib/api/client";
  import type { Label } from "@issues/api";
  import { Plus } from "@lucide/svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import FormMessage, { type FormMessage as FormMessageType } from "./FormMessage.svelte";
  import LabelRow from "./LabelRow.svelte";

  const DEFAULT_COLOUR = "#355dd4";

  let { labels, projectKey }: { labels: Label[]; projectKey: string } = $props();

  // svelte-ignore state_referenced_locally
  let labelList = $state([...labels]);
  let newLabel = $state({ name: "", colour: DEFAULT_COLOUR });
  let fieldErrors: Record<string, string> = $state({});
  let message = $state<FormMessageType | null>(null);
  let submitting = $state(false);

  function handleLabelDelete(labelID: string) {
    labelList = labelList.filter((label) => label.id !== labelID);
  }

  function handleLabelUpdate(nextLabel: Label) {
    labelList = labelList.map((label) => (label.id === nextLabel.id ? nextLabel : label));
  }

  async function handleAdd() {
    if (submitting) return;

    submitting = true;
    fieldErrors = {};
    message = null;
    try {
      const res = await client.api.projects[":key"].labels.$post({
        param: { key: projectKey },
        json: { name: newLabel.name, colour: newLabel.colour },
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string; fieldErrors?: Record<string, string> };
        message = { type: "error", text: data.message ?? "Failed to add label." };
        fieldErrors = data.fieldErrors ?? {};
        return;
      }
      const data = (await res.json()) as { label: Label };
      message = { type: "success", text: "Label added" };
      labelList = [...labelList, data.label];
      newLabel = { name: "", colour: DEFAULT_COLOUR };
    } catch {
      message = { type: "error", text: "Network error. Please try again." };
    } finally {
      submitting = false;
    }
  }
</script>

<div class="settings-card">
  {#each labelList as label (label.id)}
    <LabelRow {label} {projectKey} onDelete={handleLabelDelete} onUpdate={handleLabelUpdate} />
  {/each}

  <form
    class="new-label-footer"
    novalidate
    onsubmit={(e) => {
      e.preventDefault();
      handleAdd();
    }}
  >
    <div class="label-row">
      <label class="form-colour-picker">
        <span class="form-colour-picker-swatch" style:background-color={newLabel.colour}></span>
        <input type="color" id="new-label-colour" aria-label="Choose label colour" bind:value={newLabel.colour} disabled={submitting} />
      </label>
      <input type="text" id="new-label-name" class="form-input" bind:value={newLabel.name} placeholder="Enter label name..." required maxlength="25" disabled={submitting} />
      <Button type="submit" size="md" disabled={submitting}>
        <Plus size="14" />
        {submitting ? "Adding..." : "Add label"}
      </Button>
    </div>
    <div class="field-errors">
      {#if fieldErrors.colour}
        <span id="new-label-colour-error" class="field-error">{fieldErrors.colour}</span>
      {/if}
      {#if fieldErrors.name}
        <span id="new-label-name-error" class="field-error">{fieldErrors.name}</span>
      {/if}
    </div>
    <FormMessage {message} />
  </form>
</div>

<style>
  .settings-card {
    gap: 0.5em;
  }

  .new-label-footer {
    padding-top: 1em;
    border-top: var(--border);
  }

  .label-row {
    display: flex;
    align-items: center;
    gap: 0.75em;
  }

  .new-label-footer :global(.form-message) {
    margin-top: 0.5em;
  }
</style>
