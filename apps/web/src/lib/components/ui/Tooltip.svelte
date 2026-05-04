<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    label,
    placement = "top",
    maxWidth,
    children,
  }: {
    label: string;
    placement?: "top" | "bottom";
    /** When set, allows the tooltip to wrap up to this width (e.g. "16rem"). Otherwise stays single-line. */
    maxWidth?: string;
    children: Snippet;
  } = $props();

  let open = $state(false);

  function show() {
    open = true;
  }

  function hide() {
    open = false;
  }
</script>

<span class="tooltip-wrap" onpointerenter={show} onpointerleave={hide} onfocusin={show} onfocusout={hide} role="presentation">
  {@render children()}
  {#if open}
    <span class="tooltip" data-placement={placement} data-wrap={maxWidth ? "true" : "false"} style:max-width={maxWidth} role="tooltip">{label}</span>
  {/if}
</span>

<style>
  .tooltip-wrap {
    position: relative;
    display: inline-flex;
  }

  .tooltip {
    position: absolute;
    left: 50%;
    background: var(--colour-text);
    color: rgb(from var(--colour-bg) r g b / 0.9);
    font-size: 0.75rem;
    font-weight: 500;
    line-height: 1.45;
    padding: 5px 10px;
    border-radius: var(--border-radius-inner);
    text-align: center;
    white-space: nowrap;
    pointer-events: none;
    transform: translateX(-50%);
    z-index: 200;
    box-shadow: rgb(from var(--colour-text) r g b / 0.25) 0px 2px 8px;
    animation: tooltip-in 0.15s ease-out;
  }

  .tooltip[data-wrap="true"] {
    white-space: normal;
  }

  .tooltip[data-placement="top"] {
    bottom: calc(100% + 7px);
  }

  .tooltip[data-placement="bottom"] {
    top: calc(100% + 7px);
  }

  .tooltip[data-placement="top"]::after,
  .tooltip[data-placement="bottom"]::after {
    content: "";
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    border: 4px solid transparent;
  }

  .tooltip[data-placement="top"]::after {
    top: 100%;
    border-top-color: var(--colour-text);
  }

  .tooltip[data-placement="bottom"]::after {
    bottom: 100%;
    border-bottom-color: var(--colour-text);
  }

  @keyframes tooltip-in {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(3px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
</style>
