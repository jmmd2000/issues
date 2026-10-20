<script lang="ts">
  import { Search } from "@lucide/svelte";
  import ShortcutHint from "$lib/components/ui/ShortcutHint.svelte";

  let {
    value = $bindable(""),
    placeholder = "Search…",
    ariaLabel,
    shortcut,
    inputElement = $bindable(null),
    onInput,
  }: {
    value?: string;
    placeholder?: string;
    ariaLabel?: string;
    /** A key hint shown at the end of the field, for example `/`. */
    shortcut?: string;
    inputElement?: HTMLInputElement | null;
    onInput?: (value: string) => void;
  } = $props();

  function handleInput(event: Event) {
    const next = (event.currentTarget as HTMLInputElement).value;
    value = next;
    onInput?.(next);
  }
</script>

<div class="search-wrap">
  <span class="search-icon" aria-hidden="true">
    <Search size={14} strokeWidth={2} />
  </span>
  <input bind:this={inputElement} class="form-input search-input" type="search" {placeholder} {value} aria-label={ariaLabel ?? placeholder} oninput={handleInput} />
  {#if shortcut}<span class="shortcut"><ShortcutHint label={shortcut} /></span>{/if}
</div>

<style>
  .search-wrap {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
  }

  .search-icon {
    position: absolute;
    left: 0.7em;
    display: inline-flex;
    color: var(--colour-muted);
    pointer-events: none;
  }

  .shortcut {
    position: absolute;
    right: 0.6em;
    display: inline-flex;
    color: var(--colour-muted);
    pointer-events: none;
  }

  .search-input {
    min-height: 2.4em;
    padding: 0.45em 0.7em 0.45em 2.2em;
    font-size: 0.85em;
    line-height: 1.2;
  }
</style>
