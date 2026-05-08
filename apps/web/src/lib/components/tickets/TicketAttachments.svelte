<script lang="ts">
  import { Plus, Upload, X, FileText, FileArchive, FileCode, File as FileIcon } from "@lucide/svelte";
  import type { Attachment } from "@issues/api";
  import { client } from "$lib/api/client";
  import { attachmentURL, uploadTicketAttachment } from "$lib/uploads";

  interface TicketAttachmentsProps {
    attachments: Attachment[];
    projectKey: string;
    ticketNumber: number;
    onmutated: () => void | Promise<void>;
  }

  let { attachments, projectKey, ticketNumber, onmutated }: TicketAttachmentsProps = $props();

  type Pending = { id: string; filename: string; sizeBytes: number };

  let dragOver = $state(false);
  let pending = $state<Pending[]>([]);
  let errorMessage = $state<string | null>(null);
  let confirmDeleteID = $state<string | null>(null);
  let deletingID = $state<string | null>(null);
  let fileInput: HTMLInputElement | null = $state(null);

  const isEmpty = $derived(attachments.length === 0 && pending.length === 0);

  function pickFiles() {
    fileInput?.click();
  }

  function onFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (files.length) void uploadAll(files);
    input.value = "";
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    dragOver = false;
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length) void uploadAll(files);
  }

  function onDragOver(event: DragEvent) {
    if (!event.dataTransfer?.types.includes("Files")) return;
    event.preventDefault();
    dragOver = true;
  }

  function onDragLeave(event: DragEvent) {
    // dragleave fires for child elements too — only clear when leaving the box itself.
    const related = event.relatedTarget as Node | null;
    if (related && (event.currentTarget as Node).contains(related)) return;
    dragOver = false;
  }

  async function uploadAll(files: File[]) {
    errorMessage = null;
    const placeholders = files.map((file) => ({
      id: `pending-${crypto.randomUUID()}`,
      filename: file.name,
      sizeBytes: file.size,
    }));
    pending = [...pending, ...placeholders];

    await Promise.all(
      files.map(async (file, idx) => {
        try {
          await uploadTicketAttachment(projectKey, ticketNumber, file);
        } catch (err) {
          errorMessage = err instanceof Error ? err.message : "Upload failed.";
        } finally {
          const placeholderID = placeholders[idx].id;
          pending = pending.filter((p) => p.id !== placeholderID);
        }
      })
    );

    await onmutated();
  }

  async function deleteAttachment(attachment: Attachment) {
    if (deletingID) return;
    deletingID = attachment.id;
    try {
      const res = await client.api.projects[":key"].attachments[":id"].$delete({
        param: { key: projectKey, id: attachment.id },
      });
      if (!res.ok) return;
      confirmDeleteID = null;
      await onmutated();
    } finally {
      deletingID = null;
    }
  }

  function formatSize(bytes: number): string {
    if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
    if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
    return `${bytes} B`;
  }

  function iconFor(filename: string) {
    const ext = filename.toLowerCase().split(".").pop() ?? "";
    if (["pdf", "doc", "docx", "txt", "md", "log"].includes(ext)) return FileText;
    if (["zip", "tar", "gz", "tgz", "7z"].includes(ext)) return FileArchive;
    if (["json", "diff", "patch", "sql", "csv"].includes(ext)) return FileCode;
    return FileIcon;
  }
</script>

<section class="attachments-card" class:drag-over={dragOver} class:empty={isEmpty} aria-label="Attachments" ondragover={onDragOver} ondragleave={onDragLeave} ondrop={onDrop}>
  <header class="header">
    <h2>Attachments</h2>
    <span class="count">{attachments.length}</span>
    <button type="button" class="header-add" onclick={pickFiles} aria-label="Add attachment">
      <Plus size={14} strokeWidth={2.5} /> Add
    </button>
  </header>

  <input type="file" multiple bind:this={fileInput} onchange={onFileChange} hidden />

  {#if errorMessage}
    <p class="error" role="alert">{errorMessage}</p>
  {/if}

  {#if isEmpty}
    <button type="button" class="empty-state" onclick={pickFiles}>
      <Upload size={20} strokeWidth={1.8} />
      <span class="empty-title">Drag files here or click to upload</span>
      <span class="empty-hint">Images, PDFs, archives, text up to ~10MB each</span>
    </button>
  {:else}
    <div class="grid">
      {#each attachments as attachment (attachment.id)}
        <div class="tile" class:image-tile={attachment.isImage}>
          <a class="thumb" href={attachmentURL(attachment)} target="_blank" rel="noreferrer noopener" title={attachment.filename}>
            {#if attachment.isImage}
              <img src={attachmentURL(attachment)} alt={attachment.filename} loading="lazy" />
            {:else}
              {@const Icon = iconFor(attachment.filename)}
              <span class="file-icon">
                <Icon size={28} strokeWidth={1.5} />
              </span>
            {/if}
          </a>

          <div class="tile-meta">
            <span class="tile-name" title={attachment.filename}>{attachment.filename}</span>
            <span class="tile-size">{formatSize(attachment.sizeBytes)}</span>
          </div>

          {#if confirmDeleteID === attachment.id}
            <div class="tile-confirm">
              <button type="button" class="confirm-btn destructive" onclick={() => void deleteAttachment(attachment)} disabled={deletingID === attachment.id}>
                {deletingID === attachment.id ? "..." : "Confirm"}
              </button>
              <button type="button" class="confirm-btn" onclick={() => (confirmDeleteID = null)}>Cancel</button>
            </div>
          {:else}
            <button type="button" class="tile-remove" onclick={() => (confirmDeleteID = attachment.id)} aria-label={`Remove ${attachment.filename}`}>
              <X size={12} strokeWidth={2} />
            </button>
          {/if}
        </div>
      {/each}

      {#each pending as p (p.id)}
        <div class="tile pending-tile">
          <div class="thumb pending">
            <div class="spinner" aria-hidden="true"></div>
          </div>
          <div class="tile-meta">
            <span class="tile-name" title={p.filename}>{p.filename}</span>
            <span class="tile-size">Uploading…</span>
          </div>
        </div>
      {/each}

      <button type="button" class="tile add-tile" onclick={pickFiles} aria-label="Add attachment">
        <Plus size={22} strokeWidth={2} />
        <span>Add file</span>
      </button>
    </div>
  {/if}

  {#if dragOver}
    <div class="drop-overlay" aria-hidden="true">
      <Upload size={28} strokeWidth={1.8} />
      <span>Drop to upload</span>
    </div>
  {/if}
</section>

<style>
  .attachments-card {
    position: relative;
    border: var(--border);
    border-radius: var(--border-radius-outer);
    background: var(--colour-bg-lighter);
    box-shadow: var(--box-shadow);
    padding: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    transition:
      border-color 120ms ease,
      background 120ms ease;
  }

  .attachments-card.drag-over {
    border-color: var(--accent-tint-600);
    background: var(--accent-tint-900);
  }

  .header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .header h2 {
    color: var(--colour-text);
    font-size: 0.8rem;
    font-weight: 800;
  }

  .count {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--colour-muted);
    background: var(--colour-bg);
    border: var(--border);
    border-radius: 999px;
    padding: 0.1rem 0.5rem;
    line-height: 1.2;
  }

  .header-add {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.55rem;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg);
    color: var(--colour-text-secondary);
    font: inherit;
    font-size: 0.7rem;
    font-weight: 700;
    cursor: pointer;

    &:hover {
      color: var(--accent-base);
      border-color: var(--accent-tint-600);
      background: var(--accent-tint-900);
    }
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 1.5rem 1.25rem;
    border: 2px dashed var(--colour-border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg);
    color: var(--colour-text-secondary);
    font: inherit;
    cursor: pointer;
    transition:
      color 120ms ease,
      border-color 120ms ease,
      background 120ms ease;

    &:hover,
    &:focus-visible {
      color: var(--accent-base);
      border-color: var(--accent-tint-600);
      background: var(--accent-tint-900);
      outline: none;
    }
  }

  .empty-title {
    font-size: 0.85rem;
    font-weight: 700;
  }

  .empty-hint {
    font-size: 0.7rem;
    color: var(--colour-muted);
    font-weight: 500;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.6rem;
  }

  .tile {
    position: relative;
    display: flex;
    flex-direction: column;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg);
    overflow: hidden;
  }

  .thumb {
    aspect-ratio: 4 / 3;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--colour-bg);
    text-decoration: none;
    color: var(--colour-text);
    overflow: hidden;
  }

  .image-tile .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .file-icon {
    color: var(--colour-text-secondary);
  }

  .tile-meta {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    padding: 0.4rem 0.55rem 0.5rem;
    border-top: var(--border);
    background: var(--colour-bg-lighter);
  }

  .tile-name {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--colour-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tile-size {
    font-size: 0.7rem;
    color: var(--colour-muted);
    font-weight: 600;
  }

  .tile-remove {
    position: absolute;
    top: 0.3rem;
    right: 0.3rem;
    width: 1.4rem;
    height: 1.4rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    background: rgba(0, 0, 0, 0.55);
    color: white;
    border-radius: 50%;
    cursor: pointer;
    opacity: 0;
    transition: opacity 120ms ease;
  }

  .tile:hover .tile-remove,
  .tile-remove:focus-visible {
    opacity: 1;
  }

  .tile-confirm {
    position: absolute;
    inset: 0.3rem 0.3rem auto auto;
    display: inline-flex;
    gap: 0.25rem;
    padding: 0.25rem;
    background: var(--colour-bg-lighter);
    border: var(--border);
    border-radius: var(--border-radius-inner);
    box-shadow: var(--box-shadow);
  }

  .confirm-btn {
    padding: 0.2rem 0.45rem;
    border: 0;
    background: transparent;
    color: var(--colour-text-secondary);
    font: inherit;
    font-size: 0.7rem;
    font-weight: 700;
    border-radius: var(--border-radius-inner);
    cursor: pointer;

    &:hover {
      color: var(--colour-text);
      background: var(--colour-bg);
    }

    &.destructive {
      color: var(--colour-error);
    }
  }

  .pending-tile .thumb.pending {
    color: var(--colour-muted);
  }

  .spinner {
    width: 1.4rem;
    height: 1.4rem;
    border-radius: 50%;
    border: 2px solid var(--colour-border);
    border-top-color: var(--accent-base);
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .add-tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
    aspect-ratio: 4 / 3;
    border: 2px dashed var(--colour-border);
    border-radius: var(--border-radius-inner);
    background: transparent;
    color: var(--colour-muted);
    font: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      color 120ms ease,
      border-color 120ms ease,
      background 120ms ease;

    &:hover,
    &:focus-visible {
      color: var(--accent-base);
      border-color: var(--accent-tint-600);
      background: var(--accent-tint-900);
      outline: none;
    }
  }

  .drop-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    border-radius: var(--border-radius-outer);
    background: color-mix(in oklch, var(--accent-tint-900) 88%, transparent);
    color: var(--accent-base);
    font-size: 0.85rem;
    font-weight: 700;
    pointer-events: none;
    z-index: 2;
  }

  .error {
    margin: 0;
    color: var(--colour-error);
    font-size: 0.8rem;
  }
</style>
