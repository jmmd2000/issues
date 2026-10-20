<script lang="ts">
  /** A small key label such as `/` or `Ctrl+Enter`. It takes the colour of its parent. Screen readers skip it, so set `aria-keyshortcuts` on the control instead. */
  let { label }: { label: string } = $props();
</script>

<kbd class="shortcut-hint" aria-hidden="true">{label}</kbd>

<style>
  .shortcut-hint {
    padding: 0.05em 0.4em;
    border: 1px solid color-mix(in oklab, currentColor 35%, transparent);
    border-radius: var(--border-radius-inner);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    line-height: 1.4;
  }
</style>
