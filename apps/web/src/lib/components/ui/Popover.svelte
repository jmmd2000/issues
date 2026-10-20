<script lang="ts">
  import type { Snippet } from "svelte";
  import { fly } from "svelte/transition";
  import { quartOut } from "svelte/easing";
  import { placeMenu, type Placement } from "$lib/popoverPlacement";

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
  let placement: Placement = $state({ align: "start", side: "below" });

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

  function place(menuElement: HTMLElement) {
    if (!rootElement) return;
    placement = placeMenu(
      rootElement.getBoundingClientRect(),
      { width: menuElement.offsetWidth, height: menuElement.offsetHeight },
      { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight }
    );
  }
</script>

<svelte:window onclick={handleOutside} onkeydown={handleKeydown} />

<div bind:this={rootElement} class="popover">
  {@render trigger({ toggle, open })}

  {#if open}
    <div
      class="popover-menu"
      use:place
      data-align={placement.align}
      data-side={placement.side}
      role={menuRole}
      aria-label={menuLabel}
      in:fly={{ y: -4, duration: 160, easing: quartOut }}
      out:fly={{ y: -4, duration: 100, easing: quartOut }}
    >
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
    max-width: min(22rem, calc(100vw - 1rem));
    background: var(--colour-bg-lighter);
    border: var(--border);
    border-radius: var(--border-radius-inner);
    box-shadow: var(--box-shadow);
    padding: 0.3em;
    display: flex;
    flex-direction: column;
    gap: 0.15em;
    z-index: 20;

    &[data-align="end"] {
      left: auto;
      right: 0;
    }

    &[data-side="above"] {
      top: auto;
      bottom: calc(100% + 0.35em);
    }
  }
</style>
