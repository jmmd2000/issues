<script lang="ts">
  import MarkdownRenderer from "./MarkdownRenderer.svelte";
  import MarkdownToolbar, { type ToolbarInsert } from "./MarkdownToolbar.svelte";

  let {
    value = $bindable(""),
    placeholder = "",
    autofocus = false,
    minHeight = "14rem",
    onsubmit,
  }: {
    value?: string;
    placeholder?: string;
    autofocus?: boolean;
    minHeight?: string;
    onsubmit?: () => void;
  } = $props();

  let tab = $state<"write" | "preview">("write");
  let textarea: HTMLTextAreaElement | null = $state(null);

  // Programmatic autofocus — the `autofocus` attribute triggers an a11y lint warning.
  $effect(() => {
    if (autofocus) textarea?.focus();
  });

  // queueMicrotask so the caret restore happens after Svelte flushes the new `value` into the DOM.
  function wrapSelection(prefix: string, suffix = prefix, placeholderText = "") {
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end) || placeholderText;

    value = `${value.slice(0, start)}${prefix}${selected}${suffix}${value.slice(end)}`;

    queueMicrotask(() => {
      textarea?.focus();
      const offset = start + prefix.length + selected.length + suffix.length;
      textarea?.setSelectionRange(offset, offset);
    });
  }

  function handleInsert(action: ToolbarInsert) {
    wrapSelection(action.prefix, action.suffix ?? action.prefix, action.placeholder ?? "");
  }

  function insertTab() {
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    value = `${value.slice(0, start)}  ${value.slice(end)}`;
    queueMicrotask(() => textarea?.setSelectionRange(start + 2, start + 2));
  }

  function handleKeydown(event: KeyboardEvent) {
    const meta = event.metaKey || event.ctrlKey;

    if (meta && event.key === "Enter") {
      event.preventDefault();
      onsubmit?.();
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      insertTab();
      return;
    }

    if (meta && event.key.toLowerCase() === "k") {
      event.preventDefault();
      wrapSelection("[", "](https://)", "label");
    }
  }
</script>

<div class="markdown-editor" style={`--editor-min-height: ${minHeight};`}>
  <div class="editor-tabs" role="tablist">
    <button type="button" role="tab" aria-selected={tab === "write"} class:active={tab === "write"} onclick={() => (tab = "write")}>Write</button>
    <button type="button" role="tab" aria-selected={tab === "preview"} class:active={tab === "preview"} onclick={() => (tab = "preview")}>Preview</button>
  </div>

  <MarkdownToolbar oninsert={handleInsert} />

  {#if tab === "write"}
    <textarea bind:this={textarea} bind:value {placeholder} onkeydown={handleKeydown}></textarea>
  {:else}
    <div class="preview">
      {#if value.trim()}
        <MarkdownRenderer source={value} />
      {:else}
        <p class="preview-empty">Nothing to preview.</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .markdown-editor {
    display: flex;
    flex-direction: column;
    border: var(--border);
    border-radius: var(--border-radius-outer);
    overflow: hidden;
    background: var(--colour-bg-lighter);
    box-shadow: var(--box-shadow);
  }

  .editor-tabs {
    display: flex;
    gap: 0.25em;
    padding: 0.45em 0.6em 0;
    border-bottom: var(--border);
    background: var(--colour-bg);
  }

  .editor-tabs button {
    padding: 0.45em 0.8em;
    border: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: var(--colour-text-secondary);
    font-weight: 600;
    font-size: 0.8em;
    cursor: pointer;
    font-family: inherit;
    transition:
      color 0.12s,
      border-color 0.12s;
  }

  .editor-tabs button:hover {
    color: var(--colour-text);
  }

  .editor-tabs button.active {
    color: var(--colour-text);
    border-bottom-color: var(--accent-base);
  }

  textarea {
    width: 100%;
    min-height: var(--editor-min-height);
    padding: 0.8em 0.95em;
    border: 0;
    resize: vertical;
    background: var(--colour-bg-lighter);
    color: var(--colour-text);
    font-family: inherit;
    font-size: 0.9em;
    line-height: 1.6;
    outline: none;
  }

  textarea::placeholder {
    color: var(--colour-muted);
  }

  .preview {
    min-height: var(--editor-min-height);
    padding: 0.85em 0.95em;
    background: var(--colour-bg-lighter);
    overflow-x: auto;
  }

  .preview-empty {
    margin: 0;
    color: var(--colour-muted);
    font-style: italic;
    font-size: 0.9em;
  }
</style>
