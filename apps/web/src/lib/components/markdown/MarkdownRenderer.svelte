<script lang="ts">
  import { decorateTicketRefs, renderMarkdown } from "$lib/markdown";

  let { source }: { source: string } = $props();
  let container: HTMLDivElement | null = $state(null);
  const html = $derived(renderMarkdown(source));

  $effect(() => {
    void html;
    if (container) decorateTicketRefs(container);
  });
</script>

<div class="markdown-body" bind:this={container}>
  <!-- eslint-disable svelte/no-at-html-tags -->
  {@html html}
</div>

<style>
  .markdown-body {
    color: var(--colour-text);
    line-height: 1.6;
    font-size: 0.9em;
  }

  .markdown-body :global(p) {
    margin: 0;
  }

  .markdown-body :global(p + p),
  .markdown-body :global(ul + p),
  .markdown-body :global(ol + p),
  .markdown-body :global(pre + p),
  .markdown-body :global(blockquote + p),
  .markdown-body :global(h1 + *),
  .markdown-body :global(h2 + *),
  .markdown-body :global(h3 + *) {
    margin-top: 0.9em;
  }

  .markdown-body :global(h1),
  .markdown-body :global(h2),
  .markdown-body :global(h3) {
    letter-spacing: -0.01em;
    font-weight: 600;
  }

  .markdown-body :global(h1) {
    font-size: 1.35em;
  }

  .markdown-body :global(h2) {
    font-size: 1.15em;
  }

  .markdown-body :global(h3) {
    font-size: 1em;
  }

  .markdown-body :global(a) {
    color: var(--accent-base);
    text-decoration: none;
  }

  .markdown-body :global(a:hover) {
    text-decoration: underline;
  }

  .markdown-body :global(ul),
  .markdown-body :global(ol) {
    padding-left: 1.25em;
    margin: 0;
  }

  .markdown-body :global(li + li) {
    margin-top: 0.25em;
  }

  .markdown-body :global(code) {
    font-family: var(--font-mono);
    font-size: 0.9em;
    padding: 0.1em 0.35em;
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg);
    border: var(--border);
  }

  .markdown-body :global(pre) {
    overflow-x: auto;
    padding: 0.8em 0.95em;
    border-radius: var(--border-radius-inner);
    background: var(--accent-shade-900);
    color: #f5f7fd;
    margin: 0;
  }

  .markdown-body :global(pre code) {
    padding: 0;
    border: none;
    background: transparent;
    color: inherit;
  }

  .markdown-body :global(blockquote) {
    margin: 0;
    padding: 0.2em 0 0.2em 0.9em;
    border-left: 3px solid var(--colour-border);
    color: var(--colour-text-secondary);
  }
</style>
