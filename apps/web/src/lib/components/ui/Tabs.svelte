<script lang="ts">
  import type { Snippet, Component } from "svelte";

  type Tab = { id: string; label: string; icon?: Component<{ size?: number | string; class?: string }> };

  type Props = {
    tabs: Tab[];
    panels: Record<string, Snippet>;
    active?: string;
  };

  let { tabs, panels, active = $bindable(tabs[0]?.id) }: Props = $props();
</script>

<div class="tabs">
  <div class="tablist" role="tablist">
    {#each tabs as tab (tab.id)}
      {@const Icon = tab.icon}
      <button
        type="button"
        role="tab"
        id={`tab-${tab.id}`}
        aria-selected={active === tab.id}
        aria-controls={`panel-${tab.id}`}
        class="tab"
        class:active={active === tab.id}
        onclick={() => (active = tab.id)}
      >
        {#if Icon}<Icon size={14} />{/if}
        {tab.label}
      </button>
    {/each}
  </div>

  {#each tabs as tab (tab.id)}
    {#if active === tab.id}
      {@const panel = panels[tab.id] as Snippet | undefined}
      <div role="tabpanel" id={`panel-${tab.id}`} aria-labelledby={`tab-${tab.id}`} class="panel">
        {#if panel}{@render panel()}{/if}
      </div>
    {/if}
  {/each}
</div>

<style>
  .tabs {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .tablist {
    display: flex;
    gap: 2px;
    border-bottom: 1px solid var(--colour-border);
  }

  .tab {
    padding: 0.5em 0.9em;
    margin-bottom: -1px;
    font-size: 0.9em;
    font-weight: 500;
    color: var(--colour-text-secondary);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition:
      color 0.12s,
      border-color 0.12s;

    &:hover {
      color: var(--colour-text);
    }

    &.active {
      color: var(--accent-base);
      font-weight: 700;
      border-bottom-color: var(--accent-base);
    }
  }
</style>
