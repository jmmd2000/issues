<script lang="ts">
  import { Check, Columns3 } from "@lucide/svelte";

  type ColumnPickerItem = {
    id: string;
    label: string;
  };

  let {
    items,
    visible,
    onToggle,
    triggerLabel = "Columns",
  }: {
    items: ColumnPickerItem[];
    visible: Set<string>;
    onToggle: (id: string) => void;
    triggerLabel?: string;
  } = $props();

  let open = $state(false);

  function handleOutside(e: MouseEvent) {
    if (!open) return;
    const target = e.target as HTMLElement;
    if (!target.closest(".column-picker")) open = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (open && e.key === "Escape") open = false;
  }
</script>

<svelte:window onclick={handleOutside} onkeydown={handleKeydown} />

<div class="column-picker">
  <button type="button" class="trigger" onclick={() => (open = !open)} aria-expanded={open} aria-haspopup="menu">
    <Columns3 size={14} />
    {triggerLabel}
  </button>
  {#if open}
    <div class="menu" role="menu">
      {#each items as item (item.id)}
        <button type="button" class="item" role="menuitemcheckbox" aria-checked={visible.has(item.id)} onclick={() => onToggle(item.id)}>
          <span class="check"
            >{#if visible.has(item.id)}<Check size={12} />{/if}</span
          >
          <span>{item.label}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .column-picker {
    position: relative;
    display: inline-flex;
  }

  .trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    padding: 0.4em 0.65em;
    border: none;
    border-radius: var(--border-radius-inner);
    background: transparent;
    color: var(--colour-text-secondary);
    font-family: inherit;
    font-size: 0.78em;
    font-weight: 600;
    cursor: pointer;
  }

  .trigger:hover,
  .trigger[aria-expanded="true"] {
    color: var(--colour-text);
    background: var(--colour-bg-hover);
  }

  .menu {
    position: absolute;
    top: calc(100% + 0.25em);
    right: 0;
    min-width: 11em;
    background: var(--colour-bg-lighter);
    border: var(--border);
    border-radius: var(--border-radius-inner);
    box-shadow: var(--box-shadow);
    padding: 0.3em;
    display: flex;
    flex-direction: column;
    z-index: 20;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 0.5em;
    padding: 0.45em 0.5em;
    background: none;
    border: none;
    border-radius: var(--border-radius-inner);
    font-family: inherit;
    font-size: 0.8em;
    color: var(--colour-text);
    text-align: left;
    cursor: pointer;

    &:hover {
      background: var(--colour-bg-hover);
    }
  }

  .check {
    width: 0.9em;
    height: 0.9em;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-base);
  }
</style>
