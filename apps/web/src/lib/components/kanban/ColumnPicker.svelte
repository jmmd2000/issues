<script lang="ts">
  import type { Status } from "@issues/api";
  import { Check, Columns3 } from "@lucide/svelte";
  import Button from "../ui/Button.svelte";

  let {
    statuses,
    visible,
    onToggle,
  }: {
    statuses: Status[];
    visible: Set<string>;
    onToggle: (id: string) => void;
  } = $props();

  let open = $state(false);

  function handleOutside(e: MouseEvent) {
    if (!open) return;
    const target = e.target as HTMLElement;
    if (!target.closest(".column-picker")) open = false;
  }
</script>

<svelte:window onclick={handleOutside} />

<div class="column-picker">
  <Button variant="secondary" type="button" class="trigger" onclick={() => (open = !open)} aria-expanded={open} aria-haspopup="menu">
    <Columns3 size={14} /> Columns
  </Button>
  {#if open}
    <div class="menu" role="menu">
      {#each statuses as s (s.id)}
        <button type="button" class="item" role="menuitemcheckbox" aria-checked={visible.has(s.id)} onclick={() => onToggle(s.id)}>
          <span class="check"
            >{#if visible.has(s.id)}<Check size={12} />{/if}</span
          >
          <span>{s.name}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .column-picker {
    position: relative;
    display: inline-block;
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
