<script lang="ts">
  import { client } from "$lib/api/client";
  import type { LabelWithCount } from "@issues/api";
  import { Plus } from "@lucide/svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import LabelChip from "$lib/components/tickets/LabelChip.svelte";
  import ColourPicker from "./ColourPicker.svelte";
  import FormMessage, { type FormMessage as FormMessageType } from "./FormMessage.svelte";
  import LabelRow from "./LabelRow.svelte";

  const DEFAULT_COLOUR = "#355dd4";

  let { labels, projectKey }: { labels: LabelWithCount[]; projectKey: string } = $props();

  // svelte-ignore state_referenced_locally
  let labelList = $state([...labels]);
  let newLabel = $state({ name: "", colour: DEFAULT_COLOUR });
  let fieldErrors: Record<string, string> = $state({});
  let message = $state<FormMessageType | null>(null);
  let submitting = $state(false);

  function handleLabelDelete(labelID: string) {
    labelList = labelList.filter(label => label.id !== labelID);
  }

  function handleLabelUpdate(nextLabel: LabelWithCount) {
    labelList = labelList.map(label => (label.id === nextLabel.id ? nextLabel : label));
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
      const data = (await res.json()) as { label: LabelWithCount };
      labelList = [...labelList, { ...data.label, ticketCount: 0 }];
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
    class="new-label"
    novalidate
    onsubmit={e => {
      e.preventDefault();
      void handleAdd();
    }}
  >
    <ColourPicker bind:value={newLabel.colour} ariaLabel="Colour for the new label" disabled={submitting} />
    <input
      type="text"
      id="new-label-name"
      class="form-input new-name"
      aria-label="New label name"
      bind:value={newLabel.name}
      placeholder="New label"
      required
      maxlength="25"
      aria-invalid={fieldErrors.name ? "true" : undefined}
      disabled={submitting}
    />
    <span class="preview"><LabelChip name={newLabel.name.trim() || "Label"} colour={newLabel.colour} /></span>
    <Button type="submit" size="md" disabled={submitting || !newLabel.name.trim()}>
      <Plus size="14" />
      {submitting ? "Adding..." : "Add"}
    </Button>
  </form>
  <div class="field-errors">
    {#if fieldErrors.colour}
      <span id="new-label-colour-error" class="field-error">{fieldErrors.colour}</span>
    {/if}
    {#if fieldErrors.name}
      <span id="new-label-name-error" class="field-error">{fieldErrors.name}</span>
    {/if}
  </div>
  <FormMessage {message} />
</div>

<style>
  .settings-card {
    gap: 0.75rem;
  }

  .new-label {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    padding-top: 0.75rem;
    border-top: var(--border);
  }

  .new-name {
    flex: 1 1 10rem;
    min-width: 0;
    max-width: 16rem;
  }

  .preview {
    min-width: 0;
  }
</style>
