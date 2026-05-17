<script lang="ts">
  import { Pencil } from "@lucide/svelte";

  interface TicketTitleProps {
    title: string;
    saving?: boolean;
    onsave: (title: string) => boolean | Promise<boolean>;
  }

  let { title, saving = false, onsave }: TicketTitleProps = $props();

  let editing = $state(false);
  let draft = $state("");
  let localSaving = $state(false);
  let input: HTMLTextAreaElement | null = $state(null);
  const isSaving = $derived(saving || localSaving);
  const isValid = $derived(draft.trim().length > 0 && draft.trim().length <= 200);

  $effect(() => {
    if (!editing) draft = title;
  });

  function startEditing() {
    if (isSaving) return;
    draft = title;
    editing = true;
    queueMicrotask(() => {
      input?.focus();
      input?.select();
    });
  }

  function cancelEdit() {
    draft = title;
    editing = false;
  }

  async function save() {
    if (isSaving) return;
    const next = draft.trim();
    if (!next || next.length > 200) return;
    if (next === title) {
      editing = false;
      return;
    }

    localSaving = true;
    try {
      const saved = await onsave(next);
      if (saved) editing = false;
    } finally {
      localSaving = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void save();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    }
  }
</script>

<div class="ticket-title">
  {#if editing}
    <textarea bind:this={input} bind:value={draft} class="title-input" class:invalid={!isValid} rows="1" maxlength="200" disabled={isSaving} onkeydown={handleKeydown} onblur={() => void save()}
    ></textarea>
  {:else}
    <button type="button" class="title-button" onclick={startEditing} title="Edit title">
      <h1>{title}</h1>
      <span class="edit-icon" aria-hidden="true">
        <Pencil size={14} />
      </span>
    </button>
  {/if}
</div>

<style>
  .ticket-title {
    width: 100%;
    min-width: 0;
  }

  .title-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: text;
    font: inherit;

    & h1 {
      color: var(--colour-text);
      font-size: clamp(1.8rem, 1.6vw + 1.3rem, 3rem);
      line-height: 1.05;
      overflow-wrap: anywhere;
    }

    &:hover .edit-icon,
    &:focus-visible .edit-icon {
      opacity: 1;
    }
  }

  .edit-icon {
    display: inline-flex;
    color: var(--colour-muted);
    opacity: 0;
    transition: opacity 120ms ease;
  }

  .title-input {
    width: 100%;
    padding: 0.2rem 0.4rem;
    margin: -0.2rem -0.4rem;
    border: 1px solid var(--accent-tint-600);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg-lighter);
    color: var(--colour-text);
    font: inherit;
    font-size: clamp(1.8rem, 1.6vw + 1.3rem, 3rem);
    line-height: 1.05;
    font-weight: inherit;
    resize: none;
    outline: none;
    overflow: hidden;
    field-sizing: content;
  }

  .title-input.invalid {
    border-color: var(--colour-error);
  }
</style>
