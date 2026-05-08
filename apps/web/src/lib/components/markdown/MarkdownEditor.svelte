<script lang="ts">
  import MarkdownRenderer from "./MarkdownRenderer.svelte";
  import MarkdownToolbar, { type ToolbarInsert } from "./MarkdownToolbar.svelte";
  import { uploadTicketAttachment } from "$lib/uploads";

  let {
    value = $bindable(""),
    placeholder = "",
    autofocus = false,
    minHeight = "14rem",
    onsubmit,
    attachmentContext,
  }: {
    value?: string;
    placeholder?: string;
    autofocus?: boolean;
    minHeight?: string;
    onsubmit?: () => void;
    /** When provided, paste/drop of image files uploads them and inserts the resulting markdown at the cursor. */
    attachmentContext?: { projectKey: string; ticketNumber: number };
  } = $props();

  let dragOver = $state(false);

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

  /**
   * Inserts plain text at the current caret (or replaces the selection).
   * Returns the resulting offsets so callers can replace the inserted token
   * later (e.g. swap an upload placeholder for the final image markdown).
   */
  function insertAtCursor(text: string): { start: number; end: number } {
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    value = `${value.slice(0, start)}${text}${value.slice(end)}`;
    const insertedEnd = start + text.length;
    queueMicrotask(() => {
      textarea?.focus();
      textarea?.setSelectionRange(insertedEnd, insertedEnd);
    });
    return { start, end: insertedEnd };
  }

  /** Replaces a previously-inserted token in `value`. Token must be unique enough to find. */
  function replaceToken(token: string, replacement: string) {
    const idx = value.indexOf(token);
    if (idx === -1) return;
    value = value.slice(0, idx) + replacement + value.slice(idx + token.length);
  }

  let uploadCounter = 0;
  function nextPlaceholder(): string {
    uploadCounter += 1;
    return `![uploading-${uploadCounter}…]()`;
  }

  async function uploadAndInsert(file: File) {
    if (!attachmentContext) return;
    const placeholder = nextPlaceholder();
    insertAtCursor(placeholder);
    try {
      const att = await uploadTicketAttachment(attachmentContext.projectKey, attachmentContext.ticketNumber, file);
      const markdown = att.isImage ? `![${att.filename}](${att.url})` : `[${att.filename}](${att.url})`;
      replaceToken(placeholder, markdown);
    } catch (err) {
      const message = err instanceof Error ? err.message : "upload failed";
      replaceToken(placeholder, `_(${message})_`);
    }
  }

  function imageFilesFromClipboard(event: ClipboardEvent): File[] {
    const items = event.clipboardData?.items;
    if (!items) return [];
    const files: File[] = [];
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    return files;
  }

  function handlePaste(event: ClipboardEvent) {
    if (!attachmentContext) return;
    const files = imageFilesFromClipboard(event);
    if (files.length === 0) return;
    event.preventDefault();
    files.forEach((file) => void uploadAndInsert(file));
  }

  function handleDragOver(event: DragEvent) {
    if (!attachmentContext) return;
    if (!event.dataTransfer?.types.includes("Files")) return;
    event.preventDefault();
    dragOver = true;
  }

  function handleDragLeave() {
    dragOver = false;
  }

  function handleDrop(event: DragEvent) {
    if (!attachmentContext) return;
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length === 0) return;
    event.preventDefault();
    dragOver = false;
    files.forEach((file) => void uploadAndInsert(file));
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
    <textarea
      bind:this={textarea}
      bind:value
      class:drag-over={dragOver}
      {placeholder}
      onkeydown={handleKeydown}
      onpaste={handlePaste}
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
      ondrop={handleDrop}
    ></textarea>
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

  textarea.drag-over {
    background: var(--accent-tint-900);
    outline: 2px dashed var(--accent-tint-600);
    outline-offset: -4px;
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
