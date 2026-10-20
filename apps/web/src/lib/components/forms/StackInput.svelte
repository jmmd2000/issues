<script lang="ts">
  import { X } from "@lucide/svelte";
  import { STACK_SUGGESTIONS, addStackItem } from "$lib/stack";

  let { items = $bindable([]), id }: { items?: string[]; id: string } = $props();

  let draft = $state("");

  const suggestions = $derived(STACK_SUGGESTIONS.filter(suggestion => !items.some(item => item.toLowerCase() === suggestion.toLowerCase())));

  function add(value: string) {
    items = addStackItem(items, value);
    draft = "";
  }

  function remove(item: string) {
    items = items.filter(existing => existing !== item);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey) return;

    if (event.key === "Enter") {
      if (!draft.trim()) return;
      event.preventDefault();
      add(draft);
      return;
    }

    if (event.key === "Backspace" && draft === "" && items.length > 0) {
      remove(items[items.length - 1]);
    }
  }
</script>

<div class="stack-input">
  <div class="chip-box">
    {#each items as item (item)}
      <span class="chip">
        {item}
        <button type="button" aria-label="Remove {item}" onclick={() => remove(item)}><X size={11} strokeWidth={2.5} /></button>
      </span>
    {/each}
    <input {id} class="draft" bind:value={draft} placeholder={items.length === 0 ? "Type a name, press Enter" : ""} autocomplete="off" onkeydown={handleKeydown} />
  </div>
  {#if suggestions.length > 0}
    <div class="suggestions" aria-label="Suggestions">
      {#each suggestions as suggestion (suggestion)}
        <button type="button" class="suggestion" onclick={() => add(suggestion)}>+ {suggestion}</button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .chip-box {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.5rem;
    border: 1px solid var(--colour-border-control);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg-lighter);
    box-shadow: var(--shadow-field);
    transition:
      border-color var(--motion-fast) var(--ease-out-quart),
      box-shadow var(--motion-fast) var(--ease-out-quart);

    &:hover {
      border-color: var(--colour-border-control-hover);
    }

    &:focus-within {
      border-color: var(--colour-focus);
      box-shadow: var(--shadow-field), var(--shadow-focus-halo);
    }
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.25rem 0.125rem 0.5rem;
    border: 1px solid var(--colour-border-control);
    border-radius: 999px;
    background: var(--colour-bg);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 500;

    & button {
      display: grid;
      place-items: center;
      width: 1.125rem;
      height: 1.125rem;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--colour-muted);
      cursor: pointer;

      &:hover {
        background: var(--colour-bg-hover);
        color: var(--colour-text);
      }
    }
  }

  .draft {
    flex: 1;
    min-width: 8rem;
    padding: 0.125rem 0.25rem;
    border: 0;
    background: transparent;
    font-size: 0.9375rem;
    outline: none;
  }

  .suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-top: 0.5rem;
  }

  .suggestion {
    padding: 0.125rem 0.5rem;
    border: 1px dashed var(--colour-border-control);
    border-radius: 999px;
    background: transparent;
    color: var(--colour-text-secondary);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    cursor: pointer;

    &:hover {
      background: var(--colour-bg-hover);
      color: var(--colour-text);
    }
  }
</style>
