<script lang="ts">
  import Button from "$lib/components/ui/Button.svelte";
  import MarkdownEditor from "$lib/components/markdown/MarkdownEditor.svelte";
  import MarkdownRenderer from "$lib/components/markdown/MarkdownRenderer.svelte";

  interface TicketDescriptionProps {
    description: string;
    saving?: boolean;
    onsave: (description: string) => boolean | Promise<boolean>;
  }

  let { description, saving = false, onsave }: TicketDescriptionProps = $props();

  let editing = $state(false);
  let draft = $state("");
  let localSaving = $state(false);
  const isSaving = $derived(saving || localSaving);

  $effect(() => {
    if (!editing) draft = description;
  });

  function startEditing() {
    draft = description;
    editing = true;
  }

  function cancelEdit() {
    draft = description;
    editing = false;
  }

  async function save() {
    if (isSaving) return;

    localSaving = true;
    try {
      const saved = await onsave(draft);

      if (saved) editing = false;
    } finally {
      localSaving = false;
    }
  }
</script>

<section class="description-card">
  <div class="section-header">
    <h2>Description</h2>

    {#if !editing}
      <div class="description-edit">
        <Button type="button" variant="secondary" size="sm" onclick={startEditing}>Edit</Button>
      </div>
    {/if}
  </div>

  {#if editing}
    <MarkdownEditor bind:value={draft} minHeight="14rem" autofocus onsubmit={() => void save()} />

    <div class="description-actions">
      <Button type="button" variant="secondary" onclick={cancelEdit} disabled={isSaving}>Cancel</Button>
      <Button type="button" onclick={() => void save()} disabled={isSaving}>
        {isSaving ? "Saving..." : "Save"}
      </Button>
    </div>
  {:else if description.trim()}
    <div class="description-view">
      <MarkdownRenderer source={description} />
    </div>
  {:else}
    <button type="button" class="empty-description" onclick={startEditing}>Add description</button>
  {/if}
</section>

<style>
  .description-card {
    position: relative;
    padding: 1rem;
    border: var(--border);
    border-radius: var(--border-radius-outer);
    background: var(--colour-bg-lighter);
    box-shadow: var(--box-shadow);
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.85rem;
  }

  .section-header h2 {
    color: var(--colour-text);
    font-size: 0.8rem;
    font-weight: 800;
  }

  .description-edit {
    opacity: 0;
    pointer-events: none;
    transition: opacity 120ms ease;
  }

  .description-card:hover .description-edit,
  .description-card:focus-within .description-edit {
    opacity: 1;
    pointer-events: auto;
  }

  .description-view {
    min-height: 8rem;
  }

  .empty-description {
    width: 100%;
    min-height: 8rem;
    padding: 0.9rem;
    border: 1px dashed var(--colour-border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg);
    color: var(--colour-muted);
    text-align: left;
    cursor: pointer;
  }

  .empty-description:hover {
    border-color: var(--accent-tint-600);
    background: var(--accent-tint-900);
    color: var(--accent-base);
  }

  .description-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }
</style>
