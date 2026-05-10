<script lang="ts">
  import { Check, Minus } from "@lucide/svelte";
  import type { Snippet } from "svelte";
  import type { HTMLInputAttributes } from "svelte/elements";

  interface CheckboxProps extends Omit<HTMLInputAttributes, "type" | "checked" | "indeterminate"> {
    /** Two-way bindable. When `indeterminate` is true the visual is dashed regardless of `checked`. */
    checked?: boolean;
    indeterminate?: boolean;
    children?: Snippet;
  }

  let { checked = $bindable(false), indeterminate = false, disabled = false, children, ...rest }: CheckboxProps = $props();
</script>

<label class="label" class:disabled>
  <span class="wrap">
    <input type="checkbox" class="native" bind:checked {disabled} {...rest} />
    <span class="box" class:checked class:indeterminate aria-hidden="true">
      {#if indeterminate}
        <Minus size={11} strokeWidth={3} color="white" />
      {:else if checked}
        <Check size={11} strokeWidth={3} color="white" />
      {/if}
    </span>
  </span>
  {#if children}
    <span class="text">{@render children()}</span>
  {/if}
</label>

<style>
  .label {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    user-select: none;
    font-size: 0.85rem;
    color: var(--colour-text);
  }

  .label.disabled {
    cursor: not-allowed;
    color: var(--colour-muted);
  }

  .wrap {
    position: relative;
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }

  .native {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: inherit;
  }

  .box {
    width: 1rem;
    height: 1rem;
    border-radius: 3px;
    border: 1.5px solid var(--colour-border);
    background: var(--colour-bg-lighter);
    box-shadow: 0 1px 2px rgba(30, 34, 41, 0.06);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    transition: all 120ms;
  }

  .box.checked,
  .box.indeterminate {
    border-color: var(--accent-base);
    background: linear-gradient(180deg, #4a6ee8 0%, var(--accent-base) 100%);
    box-shadow:
      0 1px 3px rgba(53, 93, 212, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.14);
  }

  .native:focus-visible + .box {
    outline: 2px solid var(--accent-tint-700);
    outline-offset: 1px;
  }

  .text {
    line-height: 1.3;
  }
</style>
