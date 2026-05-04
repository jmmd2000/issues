<script lang="ts">
  import { Check, ChevronDown, LoaderCircle } from "@lucide/svelte";
  import type { Status } from "@issues/api";
  import Popover from "$lib/components/ui/Popover.svelte";

  let {
    statuses,
    value = $bindable(""),
    onselect,
    disabled = false,
    loading = false,
    size = "md",
    ariaLabel = "Status",
  }: {
    statuses: Status[];
    value?: string;
    onselect?: (value: string, previousValue: string) => void;
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

  const selectedStatus = $derived(statuses.find((status) => status.id === value) ?? null);
  const selectedName = $derived(selectedStatus?.name ?? "Unknown");
  const selectedColour = $derived(selectedStatus ? categoryColours[selectedStatus.category] : "var(--colour-status-backlog)");

  function select(next: string) {
    if (disabled) return;

    const previousValue = value;
    onselect?.(next, previousValue);
    value = next;
    open = false;
  }
</script>

<Popover bind:open {disabled} menuLabel="Ticket status">
  {#snippet trigger({ toggle, open })}
    <button
      type="button"
      class="trigger"
      data-size={size}
      data-empty={selectedStatus?.category === "backlog"}
      style:--option-colour={selectedColour}
      onclick={toggle}
      {disabled}
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-label={ariaLabel}
    >
      {#if loading}
        <LoaderCircle size={14} strokeWidth={2} class="spinner" aria-label="Saving status" />
      {:else}
        <span>{selectedName}</span>
      {/if}
      <ChevronDown size={14} strokeWidth={2} class="chevron" />
    </button>
  {/snippet}

  {#snippet menu()}
    {#each statuses as status (status.id)}
      <button type="button" class="option" style:--option-colour={categoryColours[status.category]} role="option" aria-selected={value === status.id} onclick={() => select(status.id)} {disabled}>
        <span class="check"
          >{#if value === status.id}<Check size={12} strokeWidth={3} />{/if}</span
        >
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
    background: color-mix(in oklch, var(--option-colour) 9%, white 91%);
    color: color-mix(in oklch, var(--option-colour) 78%, black 22%);
    font: inherit;
    font-weight: 650;
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;
  }

  .trigger:hover,
  .trigger:focus-visible,
  .trigger[aria-expanded="true"] {
    background: color-mix(in oklch, var(--option-colour) 14%, white 86%);
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
