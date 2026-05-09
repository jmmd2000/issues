<script lang="ts">
  import type { Snippet } from "svelte";
  import { X } from "@lucide/svelte";

  interface ModalProps {
    open: boolean;
    title: string;
    onclose: () => void;
    /** Constrain max-width. Defaults to 32rem. */
    maxWidth?: string;
    /** When false, suppresses the built-in close button on the header. */
    showCloseButton?: boolean;
    /** Main content rendered inside the dialog. */
    children: Snippet;
    /** Optional footer rendered as a flex row (e.g. action buttons). */
    footer?: Snippet;
  }

  let { open, title, onclose, maxWidth = "32rem", showCloseButton = true, children, footer }: ModalProps = $props();

  let dialog: HTMLDialogElement | null = $state(null);

  // Sync the dialog's open state to the prop. Calling .showModal()/.close()
  // is what gives us focus trap, ESC key handling, and the modal backdrop.
  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  });

  function handleClose() {
    if (open) onclose();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === dialog) onclose();
  }
</script>

<dialog bind:this={dialog} class="modal" style:--modal-max-width={maxWidth} onclose={handleClose} onclick={handleBackdropClick}>
  <header class="modal-header">
    <h2>{title}</h2>
    {#if showCloseButton}
      <button type="button" class="close" onclick={onclose} aria-label="Close">
        <X size={16} strokeWidth={2.5} />
      </button>
    {/if}
  </header>

  <div class="modal-body">
    {@render children()}
  </div>

  {#if footer}
    <footer class="modal-footer">
      {@render footer()}
    </footer>
  {/if}
</dialog>

<style>
  .modal {
    width: 100%;
    max-width: var(--modal-max-width);
    margin: auto;
    padding: 0;
    border: var(--border);
    border-radius: var(--border-radius-outer);
    background: var(--colour-bg-lighter);
    color: var(--colour-text);
    box-shadow: var(--box-shadow);

    &::backdrop {
      background: rgb(from var(--colour-text) r g b / 0.4);
      backdrop-filter: blur(2px);
    }
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.85rem 1rem;
    border-bottom: var(--border);

    & h2 {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--colour-text);
    }
  }

  .close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.6rem;
    height: 1.6rem;
    padding: 0;
    border: 0;
    border-radius: var(--border-radius-inner);
    background: transparent;
    color: var(--colour-muted);
    cursor: pointer;

    &:hover,
    &:focus-visible {
      background: var(--colour-bg-hover);
      color: var(--colour-text);
      outline: none;
    }
  }

  .modal-body {
    padding: 1rem;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-top: var(--border);
    background: var(--colour-bg);
  }
</style>
