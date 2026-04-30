<script lang="ts">
  import type { Priority } from "@issues/api";
  import type { Component } from "svelte";
  import { Minus, ArrowDown, Equal, ArrowUp, CircleAlert } from "@lucide/svelte";

  interface PriorityChipProps {
    priority: Priority;
    variant?: "badge" | "chip";
  }

  let { priority, variant = "badge" }: PriorityChipProps = $props();

  const icon: Record<Priority, Component<{ size?: number | string; class?: string; color?: string; strokeWidth?: number }>> = {
    none: Minus,
    low: ArrowDown,
    medium: Equal,
    high: ArrowUp,
    critical: CircleAlert,
  };

  const colour: Record<Priority, string> = {
    none: "var(--colour-priority-none)",
    low: "var(--colour-priority-low)",
    medium: "var(--colour-priority-medium)",
    high: "var(--colour-priority-high)",
    critical: "var(--colour-priority-critical)",
  };

  const label: Record<Priority, string> = {
    none: "None",
    low: "Low",
    medium: "Medium",
    high: "High",
    critical: "Critical",
  };

  const ariaLabel: Record<Priority, string> = {
    none: "No priority",
    low: "Low priority",
    medium: "Medium priority",
    high: "High priority",
    critical: "Critical priority",
  };

  const Icon = $derived(icon[priority]);
  const iconSize = $derived(variant === "badge" ? 12 : 14);
</script>

<span class="priority {variant}" style:--priority-colour={colour[priority]} aria-label={ariaLabel[priority]}>
  <span class="icon">
    <Icon size={iconSize} color="currentColor" strokeWidth={3} />
  </span>

  {#if variant === "chip"}
    <span>{label[priority]}</span>
  {/if}
</span>

<style>
  .priority {
    --priority-colour: var(--colour-priority-none);

    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border-radius: var(--border-radius-outer);
    box-sizing: border-box;
    vertical-align: middle;
    white-space: nowrap;
    justify-self: start;
    align-self: center;
  }

  .icon {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    color: white;
  }

  .badge {
    width: 20px;
    height: 20px;
    border: 1px solid color-mix(in oklch, var(--priority-colour) 55%, white 45%);
    background: color-mix(in oklch, var(--priority-colour) 15%, white 85%);
  }

  .badge .icon {
    color: color-mix(in oklch, var(--priority-colour) 75%, black 25%);
  }

  .chip {
    --priority-foreground: color-mix(in oklch, var(--priority-colour) 75%, black 25%);

    gap: 0.4rem;
    min-height: 1.4rem;
    padding: 0.2rem 0.4rem;
    border: 1px solid color-mix(in oklch, var(--priority-colour) 40%, white 60%);
    background: color-mix(in oklch, var(--priority-colour) 15%, white 85%);
    color: var(--priority-foreground);
    font-size: 0.7rem;
    font-weight: 600;
    line-height: 1;
  }

  .chip .icon {
    color: var(--priority-foreground);
  }
</style>
