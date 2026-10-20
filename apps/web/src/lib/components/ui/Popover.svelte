<script lang="ts">
  import type { Snippet } from "svelte";
  import { fly } from "svelte/transition";
  import { quartOut } from "svelte/easing";
  import { prefersReducedMotion } from "svelte/motion";
  import { placeMenu, type Placement } from "$lib/popoverPlacement";

  interface Props {
    open?: boolean;
    disabled?: boolean;
    menuRole?: "listbox" | "menu" | "dialog";
    menuLabel?: string;
    trigger: Snippet<[{ toggle: (event?: MouseEvent) => void; open: boolean }]>;
    menu: Snippet;
  }

  let { open = $bindable(false), disabled = false, menuRole = "listbox", menuLabel, trigger, menu }: Props = $props();

  const itemSelector = '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="option"]';
  const enterDuration = 180;
  const leaveDuration = 150;

  let rootElement: HTMLElement | null = $state(null);
  let menuElement: HTMLElement | null = $state(null);
  let placement: Placement = $state({ align: "start", side: "below" });
  let openedByKeyboard = false;
  let wasOpen = false;
  let focusStaysPut = false;
  let returnFocusPending = false;

  const hasItems = $derived(menuRole !== "dialog");

  function close() {
    open = false;
  }

  function toggle(event?: MouseEvent) {
    if (disabled) return;
    // A click made with Enter or Space has no pointer position, so its detail is 0.
    openedByKeyboard = event?.detail === 0;
    open = !open;
  }

  function triggerElement() {
    return rootElement?.firstElementChild as HTMLElement | null;
  }

  function focusStops() {
    if (!menuElement) return [];
    const stops = Array.from(menuElement.querySelectorAll<HTMLElement>(`input, ${itemSelector}`));
    return stops.filter(stop => !stop.hasAttribute("disabled") && stop.getAttribute("aria-disabled") !== "true");
  }

  function isChosen(item: HTMLElement) {
    return item.getAttribute("aria-selected") === "true" || item.getAttribute("aria-checked") === "true";
  }

  function focusOnOpen(element: HTMLElement) {
    const searchInput = element.querySelector<HTMLInputElement>("input");
    if (searchInput) {
      searchInput.focus();
      return;
    }
    if (!openedByKeyboard || !hasItems) return;
    const items = focusStops();
    (items.find(isChosen) ?? items[0])?.focus();
  }

  function moveFocus(key: string) {
    const stops = focusStops();
    if (stops.length === 0) return;
    const last = stops.length - 1;
    const current = stops.indexOf(document.activeElement as HTMLElement);

    if (key === "Home") {
      stops[0].focus();
    } else if (key === "End") {
      stops[last].focus();
    } else if (key === "ArrowDown") {
      stops[current === -1 || current === last ? 0 : current + 1].focus();
    } else {
      stops[current <= 0 ? last : current - 1].focus();
    }
  }

  function handleOutside(event: MouseEvent) {
    if (!open || !rootElement) return;
    if (!event.composedPath().includes(rootElement)) close();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (disabled || !rootElement || !event.composedPath().includes(rootElement)) return;

    if (!open) {
      if (!hasItems || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
      event.preventDefault();
      openedByKeyboard = true;
      open = true;
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (!hasItems) return;

    if (event.key === "Tab") {
      focusStaysPut = true;
      close();
      return;
    }

    const typingInSearch = (event.target as HTMLElement).tagName === "INPUT";
    const isHomeOrEnd = event.key === "Home" || event.key === "End";
    if (isHomeOrEnd && typingInSearch) return;

    if (isHomeOrEnd || event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(event.key);
    }
  }

  function place(element: HTMLElement) {
    if (rootElement) {
      placement = placeMenu(
        rootElement.getBoundingClientRect(),
        { width: element.offsetWidth, height: element.offsetHeight },
        { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight }
      );
    }
    focusOnOpen(element);
  }

  $effect(() => {
    const triggerDisabled = disabled;

    if (open) {
      wasOpen = true;
      return;
    }

    if (wasOpen) {
      wasOpen = false;
      const stayPut = focusStaysPut;
      focusStaysPut = false;
      const active = document.activeElement;
      const focusWasInMenu = !active || active === document.body || (menuElement?.contains(active) ?? false);
      returnFocusPending = !stayPut && focusWasInMenu;
    }

    // A disabled trigger cannot take focus, so wait until it is enabled again.
    if (returnFocusPending && !triggerDisabled) {
      returnFocusPending = false;
      triggerElement()?.focus();
    }
  });
</script>

<svelte:window onclick={handleOutside} onkeydown={handleKeydown} />

<div bind:this={rootElement} class="popover">
  {@render trigger({ toggle, open })}

  {#if open}
    <div
      bind:this={menuElement}
      class="popover-menu"
      use:place
      data-align={placement.align}
      data-side={placement.side}
      role={menuRole}
      aria-label={menuLabel}
      in:fly={{ y: placement.side === "above" ? 4 : -4, duration: prefersReducedMotion.current ? 0 : enterDuration, easing: quartOut }}
      out:fly={{ y: placement.side === "above" ? 4 : -4, duration: prefersReducedMotion.current ? 0 : leaveDuration, easing: quartOut }}
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
    border: 1px solid var(--colour-border-overlay);
    border-radius: var(--border-radius-inner);
    box-shadow: var(--shadow-overlay);
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
