<script lang="ts">
  import type { Priority } from "@issues/api";
  import type { Component } from "svelte";
  import { Minus, ArrowDown, Equal, ArrowUp, CircleAlert } from "@lucide/svelte";

  let { priority }: { priority: Priority } = $props();

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

  const Icon = $derived(icon[priority]);
</script>

<span class="priority" style:background={colour[priority]} aria-label={`priority ${priority}`}>
  <Icon size={12} color="white" strokeWidth={3} />
</span>

<style>
  .priority {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border-radius: 999px;
    box-sizing: border-box;
    color: white;
  }
</style>
