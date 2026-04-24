<script module lang="ts">
  export type ToolbarInsert = {
    prefix: string;
    suffix?: string;
    placeholder?: string;
  };
</script>

<script lang="ts">
  import { Bold, Code, Italic, Link2, List } from "@lucide/svelte";

  let { oninsert }: { oninsert: (action: ToolbarInsert) => void } = $props();

  const actions: Array<{ key: string; label: string; icon: typeof Bold; action: ToolbarInsert }> = [
    { key: "bold", label: "Bold", icon: Bold, action: { prefix: "**", suffix: "**", placeholder: "bold text" } },
    { key: "italic", label: "Italic", icon: Italic, action: { prefix: "_", suffix: "_", placeholder: "italic text" } },
    { key: "code", label: "Code", icon: Code, action: { prefix: "`", suffix: "`", placeholder: "code" } },
    { key: "list", label: "List", icon: List, action: { prefix: "- ", placeholder: "list item" } },
    { key: "link", label: "Link", icon: Link2, action: { prefix: "[", suffix: "](https://)", placeholder: "label" } },
  ];
</script>

<div class="toolbar" role="toolbar" aria-label="Markdown formatting">
  {#each actions as item (item.key)}
    {@const Icon = item.icon}
    <button type="button" title={item.label} aria-label={item.label} onclick={() => oninsert(item.action)}>
      <Icon size={14} strokeWidth={2} />
    </button>
  {/each}
</div>

<style>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3em;
    padding: 0.5em 0.6em;
    border-bottom: var(--border);
    background: var(--colour-bg);
  }

  .toolbar button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.9em;
    height: 1.9em;
    padding: 0;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg-lighter);
    color: var(--colour-text-secondary);
    cursor: pointer;
    transition:
      background 0.12s,
      color 0.12s;
  }

  .toolbar button:hover {
    background: var(--colour-bg-hover);
    color: var(--colour-text);
  }
</style>
