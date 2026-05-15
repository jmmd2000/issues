<script lang="ts">
  import { Search } from "@lucide/svelte";

  let {
    value = $bindable(""),
    placeholder = "Search…",
    ariaLabel,
    onInput,
  }: {
    value?: string;
    placeholder?: string;
    ariaLabel?: string;
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
  <input class="search-input" type="search" {placeholder} {value} aria-label={ariaLabel ?? placeholder} oninput={handleInput} />
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

  .search-input {
    width: 100%;
    min-height: 2.4em;
    padding: 0.45em 0.7em 0.45em 2.2em;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg-lighter);
    color: var(--colour-text);
    font: inherit;
    font-size: 0.85em;
    line-height: 1.2;
    outline: none;
    box-shadow:
      0 1px 2px rgb(from var(--colour-text) r g b / 0.07),
      inset 0 1px 0 rgb(from var(--colour-bg-lighter) r g b / 0.9);
    transition:
      border-color var(--motion-fast) var(--ease-out-quart),
      box-shadow var(--motion-fast) var(--ease-out-quart),
      background var(--motion-fast) var(--ease-out-quart);
  }

  .search-input::placeholder {
    color: var(--colour-muted);
  }

  .search-input:hover {
    background: var(--colour-bg-hover);
  }

  .search-input:focus {
    border-color: var(--accent-base);
    background: var(--colour-bg-lighter);
    box-shadow:
      0 0 0 3px color-mix(in oklch, var(--accent-base) 14%, transparent 86%),
      inset 0 1px 0 rgb(from var(--colour-bg-lighter) r g b / 0.9);
  }
</style>
