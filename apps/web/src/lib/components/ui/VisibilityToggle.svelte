<script lang="ts">
  import { Eye, EyeOff } from "@lucide/svelte";
  import type { Visibility } from "@issues/api";

  interface VisibilityToggleProps {
    value: Visibility;
    disabled?: boolean;
    size?: "sm" | "md";
    /** Called whenever the user picks the other option. Bindable callers can use $bindable + onchange together. */
    onchange?: (next: Visibility, previous: Visibility) => void;
  }

  let { value = $bindable(), disabled = false, size = "md", onchange }: VisibilityToggleProps = $props();

  function pick(next: Visibility) {
    if (disabled || next === value) return;
    const previous = value;
    value = next;
    onchange?.(next, previous);
  }

  const iconSize = $derived(size === "sm" ? 12 : 14);
</script>

<div class="toggle" data-size={size} role="radiogroup" aria-label="Visibility">
  <button type="button" class="option" class:active={value === "public"} role="radio" aria-checked={value === "public"} {disabled} onclick={() => pick("public")}>
    <Eye size={iconSize} strokeWidth={2} />
    <span>Public</span>
  </button>
  <button type="button" class="option" class:active={value === "private"} role="radio" aria-checked={value === "private"} {disabled} onclick={() => pick("private")}>
    <EyeOff size={iconSize} strokeWidth={2} />
    <span>Private</span>
  </button>
</div>

<style>
  .toggle {
    display: inline-flex;
    align-items: center;
    border: var(--border);
    border-radius: 999px;
    padding: 2px;
    background: var(--colour-bg);
    width: fit-content;
  }

  .option {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.85rem;
    border: 0;
    background: transparent;
    color: var(--colour-text-secondary);
    font: inherit;
    font-weight: 600;
    border-radius: 999px;
    cursor: pointer;
    transition:
      color var(--motion-fast) var(--ease-out-quart),
      background var(--motion-fast) var(--ease-out-quart),
      box-shadow var(--motion-fast) var(--ease-out-quart);
  }

  .option:hover:not(.active):not(:disabled) {
    color: var(--colour-text);
  }

  .option.active {
    background: linear-gradient(180deg, var(--accent-tint-200) 0%, var(--accent-base) 100%);
    color: var(--colour-bg-lighter);
    box-shadow:
      0 1px 3px rgb(from var(--accent-base) r g b / 0.3),
      inset 0 1px 0 rgb(from var(--colour-bg-lighter) r g b / 0.14);
  }

  .option:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .toggle[data-size="md"] .option {
    font-size: 0.8rem;
  }

  .toggle[data-size="sm"] .option {
    padding: 0.2rem 0.55rem;
    gap: 0.25rem;
    font-size: 0.7rem;
    font-weight: 700;
  }
</style>
