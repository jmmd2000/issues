<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    open?: boolean;
    disabled?: boolean;
    menuRole?: "listbox" | "menu" | "dialog";
    menuLabel?: string;
    trigger: Snippet<[{ toggle: () => void; open: boolean }]>;
    menu: Snippet;
  }

  let { open = $bindable(false), disabled = false, menuRole = "listbox", menuLabel, trigger, menu }: Props = $props();

  let rootElement: HTMLElement | null = $state(null);

  function close() {
    open = false;
  }

  function toggle() {
    if (disabled) return;
    open = !open;
  }

  function handleOutside(event: MouseEvent) {
    if (!open || !rootElement) return;
    if (!event.composedPath().includes(rootElement)) close();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (open && event.key === "Escape") close();
  }
</script>

<svelte:window onclick={handleOutside} onkeydown={handleKeydown} />

<div bind:this={rootElement} class="popover">
  {@render trigger({ toggle, open })}

  {#if open}
    <div class="popover-menu" role={menuRole} aria-label={menuLabel}>
      {@render menu()}
    </div>
  {/if}
</div>

<style>
  .popover {
    position: relative;
    display: inline-block;
    width: fit-content;
    max-width: 100%;
  }

  .popover-menu {
    position: absolute;
    top: calc(100% + 0.35em);
    left: 0;
    min-width: 12rem;
    max-width: 22rem;
    background: var(--colour-bg-lighter);
    border: var(--border);
    border-radius: var(--border-radius-inner);
    box-shadow: var(--box-shadow);
    padding: 0.3em;
    display: flex;
    flex-direction: column;
    gap: 0.15em;
    z-index: 20;
  }
</style>
