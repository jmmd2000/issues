<script lang="ts">
  import { Check, ChevronDown, LoaderCircle } from "@lucide/svelte";
  import type { Status } from "@issues/api";
  import StatusChip from "./StatusChip.svelte";
  import Popover from "$lib/components/ui/Popover.svelte";

  let {
    statuses,
    multi = false,
    value = $bindable(""),
    selected = [],
    onselect,
    onChange,
    placeholder = "Status",
    disabled = false,
    loading = false,
    size = "md",
    ariaLabel = "Status",
  }: {
    statuses: Status[];
    multi?: boolean;
    /** Single-mode value. Ignored when `multi` is true. */
    value?: string;
    /** Multi-mode selection. Ignored when `multi` is false. */
    selected?: string[];
    onselect?: (value: string, previousValue: string) => void;
    onChange?: (next: string[]) => void;
    /** Placeholder shown in multi mode when nothing is selected. */
    placeholder?: string;
    disabled?: boolean;
    loading?: boolean;
    size?: "sm" | "md";
    ariaLabel?: string;
  } = $props();

  const categoryColours: Record<Status["category"], string> = {
    backlog: "var(--colour-status-backlog)",
    active: "var(--colour-status-active)",
    done: "var(--colour-status-done)",
    cancelled: "var(--colour-status-cancelled)",
  };

  let open = $state(false);

  const selectedSet = $derived(new Set(selected));
  const selectedStatuses = $derived(statuses.filter((status) => selectedSet.has(status.id)));
  const singleStatus = $derived(statuses.find((status) => status.id === value) ?? null);
  const singleColour = $derived(singleStatus ? categoryColours[singleStatus.category] : "var(--colour-status-backlog)");

  function selectSingle(next: string) {
    if (disabled) return;
    const previousValue = value;
    onselect?.(next, previousValue);
    value = next;
    open = false;
  }

  function toggleMulti(next: string) {
    if (disabled) return;
    onChange?.(selectedSet.has(next) ? selected.filter((id) => id !== next) : [...selected, next]);
  }
</script>

<Popover bind:open {disabled} menuLabel="Ticket status">
  {#snippet trigger({ toggle, open })}
    <button
      type="button"
      class="trigger"
      data-size={size}
      data-empty={multi ? selectedStatuses.length === 0 : singleStatus?.category === "backlog"}
      data-multi={multi}
      style:--option-colour={singleColour}
      onclick={toggle}
      {disabled}
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-label={ariaLabel}
    >
      {#if loading}
        <LoaderCircle size={14} strokeWidth={2} class="spinner" aria-label="Saving status" />
      {:else if multi}
        {#if selectedStatuses.length === 0}
          <span class="placeholder">{placeholder}</span>
        {:else}
          <span class="chip-row">
            {#each selectedStatuses as status (status.id)}
              <StatusChip name={status.name} category={status.category} />
            {/each}
          </span>
        {/if}
      {:else}
        <span>{singleStatus?.name ?? "Unknown"}</span>
      {/if}
      <ChevronDown size={14} strokeWidth={2} class="chevron" />
    </button>
  {/snippet}

  {#snippet menu()}
    {#each statuses as status (status.id)}
      {@const isSelected = multi ? selectedSet.has(status.id) : value === status.id}
      <button
        type="button"
        class="option"
        style:--option-colour={categoryColours[status.category]}
        role="option"
        aria-selected={isSelected}
        onclick={() => (multi ? toggleMulti(status.id) : selectSingle(status.id))}
        {disabled}
      >
        <span class="check">
          {#if isSelected}<Check size={12} strokeWidth={3} />{/if}
        </span>
        <span>{status.name}</span>
      </button>
    {/each}
  {/snippet}
</Popover>

<style>
  .trigger {
    --option-colour: var(--colour-status-backlog);

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
    color: var(--colour-text-secondary);
    font-weight: 600;
  }

  .trigger[data-empty="true"]:hover,
  .trigger[data-empty="true"]:focus-visible,
  .trigger[data-empty="true"][aria-expanded="true"] {
    background: var(--colour-bg-hover);
    color: var(--colour-text);
  }

  .trigger[data-multi="true"]:not([data-empty="true"]) {
    border-color: var(--colour-border);
    background: var(--colour-bg);
    color: var(--colour-text);
    flex-wrap: wrap;
    row-gap: 0.3em;
  }

  .trigger[data-multi="true"]:not([data-empty="true"]):hover,
  .trigger[data-multi="true"]:not([data-empty="true"]):focus-visible,
  .trigger[data-multi="true"]:not([data-empty="true"])[aria-expanded="true"] {
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

  .placeholder {
    color: inherit;
  }

  .chip-row {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.35em;
    row-gap: 0.3em;
    max-width: 22em;
  }

  .option {
    --option-colour: var(--colour-status-backlog);

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
