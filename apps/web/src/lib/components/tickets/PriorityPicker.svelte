<script lang="ts">
  import { ArrowDown, ArrowUp, Check, ChevronDown, CircleAlert, Equal, LoaderCircle, Minus } from "@lucide/svelte";
  import type { Priority } from "@issues/api";
  import type { Component } from "svelte";
  import Popover from "$lib/components/ui/Popover.svelte";

  const options: Array<{
    value: Priority;
    label: string;
    colour: string;
    icon: Component<{ size?: number | string; color?: string; strokeWidth?: number }>;
  }> = [
    { value: "critical", label: "Critical", colour: "var(--colour-priority-critical)", icon: CircleAlert },
    { value: "high", label: "High", colour: "var(--colour-priority-high)", icon: ArrowUp },
    { value: "medium", label: "Medium", colour: "var(--colour-priority-medium)", icon: Equal },
    { value: "low", label: "Low", colour: "var(--colour-priority-low)", icon: ArrowDown },
    { value: "none", label: "None", colour: "var(--colour-priority-none)", icon: Minus },
  ];

  let {
    value = $bindable<Priority>("medium"),
    onselect,
    disabled = false,
    loading = false,
    size = "md",
    ariaLabel = "Priority",
  }: {
    value?: Priority;
    onselect?: (value: Priority, previousValue: Priority) => void;
    disabled?: boolean;
    loading?: boolean;
    size?: "sm" | "md";
    ariaLabel?: string;
  } = $props();

  let open = $state(false);

  const selectedOption = $derived(options.find((option) => option.value === value) ?? options[options.length - 1]);

  function select(next: Priority) {
    if (disabled) return;

    const previousValue = value;
    onselect?.(next, previousValue);
    value = next;
    open = false;
  }
</script>

<Popover bind:open {disabled} menuLabel="Ticket priority">
  {#snippet trigger({ toggle, open })}
    {@const SelectedIcon = selectedOption.icon}
    <button
      type="button"
      class="trigger"
      data-size={size}
      data-empty={value === "none"}
      style:--option-colour={selectedOption.colour}
      onclick={toggle}
      {disabled}
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-label={ariaLabel}
    >
      {#if loading}
        <LoaderCircle size={14} strokeWidth={2} class="spinner" aria-label="Saving priority" />
      {:else}
        <span class="priority-icon">
          <SelectedIcon size={14} color="currentColor" strokeWidth={3} />
        </span>
        <span>{selectedOption.label}</span>
      {/if}
      <ChevronDown size={14} strokeWidth={2} class="chevron" />
    </button>
  {/snippet}

  {#snippet menu()}
    {#each options as option (option.value)}
      {@const Icon = option.icon}
      <button type="button" class="option" style:--option-colour={option.colour} role="option" aria-selected={value === option.value} onclick={() => select(option.value)} {disabled}>
        <span class="check"
          >{#if value === option.value}<Check size={12} strokeWidth={3} />{/if}</span
        >
        <span class="priority-icon">
          <Icon size={14} color="currentColor" strokeWidth={3} />
        </span>
        <span>{option.label}</span>
      </button>
    {/each}
  {/snippet}
</Popover>

<style>
  .trigger {
    --option-colour: var(--colour-priority-none);

    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    border: 1px solid color-mix(in oklch, var(--option-colour) 25%, white 75%);
    border-radius: var(--border-radius-inner);
    background: color-mix(in oklch, var(--option-colour) 10%, white 90%);
    color: color-mix(in oklch, var(--option-colour) 80%, black 20%);
    font: inherit;
    font-weight: 650;
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;
  }

  .trigger:hover,
  .trigger:focus-visible,
  .trigger[aria-expanded="true"] {
    background: color-mix(in oklch, var(--option-colour) 15%, white 85%);
  }

  .trigger[data-size="md"] {
    min-height: 2.4em;
    padding: 0.45em 0.7em;
    font-size: 0.85em;
  }

  .trigger[data-empty="true"] {
    border-color: var(--colour-border);
    background: var(--colour-bg);
    color: var(--colour-muted);
    font-weight: 500;
  }

  .trigger[data-empty="true"]:hover,
  .trigger[data-empty="true"]:focus-visible,
  .trigger[data-empty="true"][aria-expanded="true"] {
    background: var(--colour-bg-hover);
  }

  .trigger[data-size="sm"] {
    margin-left: -0.4rem;
    padding: 0.25rem 0.45rem;
    font-size: 0.7rem;
  }

  .trigger:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }

  .trigger :global(.chevron) {
    color: currentColor;
    opacity: 0.7;
  }

  .trigger :global(.spinner) {
    animation: spin 720ms linear infinite;
    color: currentColor;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .priority-icon {
    display: inline-grid;
    place-items: center;
    flex: 0 0 auto;
    width: 1rem;
    height: 1rem;
  }

  .option {
    --option-colour: var(--colour-priority-none);

    display: flex;
    align-items: center;
    gap: 0.5em;
    padding: 0.4em 0.5em;
    border: none;
    border-radius: var(--border-radius-inner);
    background: color-mix(in oklch, var(--option-colour) 10%, white 90%);
    color: color-mix(in oklch, var(--option-colour) 80%, black 20%);
    font: inherit;
    font-size: 0.8rem;
    font-weight: 650;
    text-align: left;
    cursor: pointer;
  }

  .option:hover {
    background: color-mix(in oklch, var(--option-colour) 15%, white 85%);
  }

  .option[aria-selected="true"] {
    background: color-mix(in oklch, var(--option-colour) 20%, white 80%);
    font-weight: 800;
  }

  .option:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }

  .check {
    width: 0.9em;
    height: 0.9em;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: currentColor;
    flex-shrink: 0;
  }
</style>
