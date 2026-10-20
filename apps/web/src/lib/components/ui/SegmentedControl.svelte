<script lang="ts" module>
  import type { Component } from "svelte";

  export interface SegmentedOption<Value extends string = string> {
    value: Value;
    label: string;
    icon?: Component<{ size?: number | string; strokeWidth?: number }>;
    /** Shows only the icon. The label is still the accessible name. */
    iconOnly?: boolean;
  }
</script>

<script lang="ts" generics="Value extends string">
  interface Props {
    options: SegmentedOption<Value>[];
    value: Value;
    /** Names the group for assistive technology. */
    label: string;
    disabled?: boolean;
    size?: "sm" | "md";
    /** Called whenever the user picks a different option. */
    onchange?: (next: Value, previous: Value) => void;
  }

  let { options, value = $bindable(), label, disabled = false, size = "md", onchange }: Props = $props();

  const buttons: (HTMLButtonElement | null)[] = $state([]);

  const iconSize = $derived(size === "sm" ? 12 : 14);

  function choose(next: Value) {
    if (disabled || next === value) return;
    const previous = value;
    value = next;
    onchange?.(next, previous);
  }

  function handleKeydown(event: KeyboardEvent, index: number) {
    const last = options.length - 1;
    let target: number;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      target = index === last ? 0 : index + 1;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      target = index === 0 ? last : index - 1;
    } else if (event.key === "Home") {
      target = 0;
    } else if (event.key === "End") {
      target = last;
    } else {
      return;
    }

    event.preventDefault();
    buttons[target]?.focus();
    choose(options[target].value);
  }
</script>

<div class="segmented" data-size={size} role="radiogroup" aria-label={label}>
  {#each options as option, index (option.value)}
    {@const Icon = option.icon}
    <button
      bind:this={buttons[index]}
      type="button"
      class="option"
      role="radio"
      aria-checked={value === option.value}
      aria-label={option.iconOnly ? option.label : undefined}
      title={option.iconOnly ? option.label : undefined}
      tabindex={value === option.value ? 0 : -1}
      {disabled}
      onclick={() => choose(option.value)}
      onkeydown={event => handleKeydown(event, index)}
    >
      {#if Icon}<Icon size={iconSize} strokeWidth={2} />{/if}
      {#if !option.iconOnly}<span>{option.label}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .segmented {
    display: inline-flex;
    gap: 2px;
    width: fit-content;
    padding: 2px;
    border: 1px solid var(--colour-border-control);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg);
    box-shadow: var(--shadow-field);
  }

  .option {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    padding: 0.25rem 0.75rem;
    border: 0;
    border-radius: 2px;
    background: transparent;
    color: var(--colour-text-secondary);
    font: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      color var(--motion-fast) var(--ease-out-quart),
      background var(--motion-fast) var(--ease-out-quart),
      box-shadow var(--motion-fast) var(--ease-out-quart);

    &:hover:not(:disabled):not([aria-checked="true"]) {
      background: var(--colour-bg-hover);
      color: var(--colour-text);
    }

    &[aria-checked="true"] {
      background: var(--colour-bg-lighter);
      color: var(--colour-text);
      box-shadow:
        0 0 0 1px var(--colour-border-control),
        0 1px 2px rgb(from var(--colour-shadow) r g b / 0.1);
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }
  }

  .segmented[data-size="sm"] .option {
    padding: 0.2rem 0.55rem;
    gap: 0.25rem;
    font-size: 0.7rem;
    font-weight: 700;
  }
</style>
