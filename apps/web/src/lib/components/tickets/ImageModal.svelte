<script lang="ts">
  import { X } from "@lucide/svelte";
  import type { Attachment } from "@issues/api";
  import { attachmentURL } from "$lib/uploads";

  interface ImageModalProps {
    open: boolean;
    attachment: Attachment | null;
    onclose: () => void;
  }

  let { open, attachment, onclose }: ImageModalProps = $props();

  let dialog: HTMLDialogElement | null = $state(null);

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  });

  $effect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  });

  function handleClose() {
    if (open) onclose();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (!(event.target instanceof Element)) return;
    if (event.target.tagName === "IMG") return;
    onclose();
  }

  function formatSize(bytes: number): string {
    if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
    if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
    return `${bytes} B`;
  }
</script>

<dialog bind:this={dialog} class="image-modal" onclose={handleClose} onclick={handleBackdropClick} aria-label={attachment ? `Image preview: ${attachment.filename}` : "Image preview"}>
  {#if attachment}
    <button type="button" class="close" onclick={onclose} aria-label="Close">
      <X size={18} strokeWidth={2.5} />
    </button>

    <figure class="frame">
      <img src={attachmentURL(attachment)} alt={attachment.filename} width={attachment.width ?? undefined} height={attachment.height ?? undefined} />
      <figcaption class="caption">
        <span class="filename" title={attachment.filename}>{attachment.filename}</span>
        <span class="meta">
          <span>{formatSize(attachment.sizeBytes)}</span>
          <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
          <a class="original-link" href={attachmentURL(attachment)} target="_blank" rel="noreferrer noopener">Open original</a>
        </span>
      </figcaption>
    </figure>
  {/if}
</dialog>

<style>
  .image-modal {
    width: 100%;
    height: 100%;
    max-width: none;
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--colour-text);
    overflow: hidden;
    opacity: 0;
    transition:
      opacity var(--motion-base) var(--ease-out-quart),
      overlay var(--motion-base) allow-discrete,
      display var(--motion-base) allow-discrete;

    &[open] {
      opacity: 1;
    }

    @starting-style {
      &[open] {
        opacity: 0;
      }
    }

    &::backdrop {
      background: rgb(0 0 0 / 0);
      backdrop-filter: blur(0);
      transition:
        background var(--motion-base) var(--ease-out-quart),
        backdrop-filter var(--motion-base) var(--ease-out-quart),
        overlay var(--motion-base) allow-discrete,
        display var(--motion-base) allow-discrete;
    }

    &[open]::backdrop {
      background: rgb(0 0 0 / 0.85);
      backdrop-filter: blur(4px);
    }

    @starting-style {
      &[open]::backdrop {
        background: rgb(0 0 0 / 0);
        backdrop-filter: blur(0);
      }
    }
  }

  .close {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: rgb(0 0 0 / 0.55);
    color: white;
    cursor: pointer;
    transition:
      background var(--motion-fast) var(--ease-out-quart),
      transform var(--motion-fast) var(--ease-out-quart);

    &:hover,
    &:focus-visible {
      background: rgb(0 0 0 / 0.75);
      transform: scale(1.05);
      outline: none;
    }
  }

  .frame {
    width: 100%;
    height: 100%;
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 3rem 2rem 2rem;
    box-sizing: border-box;
  }

  .frame img {
    max-width: 100%;
    max-height: calc(100vh - 8rem);
    width: auto;
    height: auto;
    object-fit: contain;
    border-radius: var(--border-radius-inner);
    box-shadow: 0 1.25rem 3rem rgb(0 0 0 / 0.5);
  }

  .caption {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    max-width: 100%;
    color: rgb(255 255 255 / 0.95);
    text-align: center;
  }

  .filename {
    font-size: 0.85rem;
    font-weight: 600;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .meta {
    display: inline-flex;
    align-items: center;
    gap: 0.85rem;
    font-size: 0.75rem;
    color: rgb(255 255 255 / 0.7);
    font-weight: 500;
  }

  .original-link {
    color: rgb(255 255 255 / 0.95);
    text-decoration: underline;
    text-underline-offset: 0.2em;

    &:hover,
    &:focus-visible {
      color: white;
    }
  }
</style>
