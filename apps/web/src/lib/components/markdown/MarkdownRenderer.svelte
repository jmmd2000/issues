<script lang="ts">
  import { X } from "@lucide/svelte";
  import { decorateTicketRefs, renderMarkdown } from "$lib/markdown";

  let { source }: { source: string } = $props();
  let container: HTMLDivElement | null = $state(null);
  let lightboxSrc = $state<string | null>(null);
  let lightboxAlt = $state<string>("");
  const html = $derived(renderMarkdown(source));

  $effect(() => {
    void html;
    if (container) decorateTicketRefs(container);
  });

  $effect(() => {
    if (!lightboxSrc) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") lightboxSrc = null;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function handleClick(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    if (!target || target.tagName !== "IMG") return;
    const img = target as HTMLImageElement;
    event.preventDefault();
    lightboxSrc = img.currentSrc || img.src;
    lightboxAlt = img.alt;
  }

  function closeLightbox() {
    lightboxSrc = null;
  }
</script>

<div class="markdown-body" bind:this={container} onclick={handleClick} role="presentation">
  <!-- eslint-disable svelte/no-at-html-tags -->
  {@html html}
</div>

{#if lightboxSrc}
  <button type="button" class="lightbox" onclick={closeLightbox} aria-label="Close image">
    <img class="lightbox-image" src={lightboxSrc} alt={lightboxAlt} />
    <span class="lightbox-close" aria-hidden="true">
      <X size={20} strokeWidth={2.5} />
    </span>
  </button>
{/if}

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

  .markdown-body :global(img) {
    display: block;
    max-width: 100%;
    max-height: 28rem;
    height: auto;
    border-radius: var(--border-radius-inner);
    border: var(--border);
    cursor: zoom-in;
    margin: 0.5rem 0;
  }

  .lightbox {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    border: 0;
    background: rgba(15, 17, 22, 0.85);
    cursor: zoom-out;
  }

  .lightbox-image {
    max-width: 95vw;
    max-height: 90vh;
    object-fit: contain;
    border-radius: var(--border-radius-inner);
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
  }

  .lightbox-close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.12);
    color: white;
    pointer-events: none;
  }
</style>
