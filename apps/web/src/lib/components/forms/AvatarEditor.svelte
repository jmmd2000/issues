<script lang="ts">
  import { onDestroy } from "svelte";
  import { Upload } from "@lucide/svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import FormMessage, { type FormMessage as FormMessageType } from "./FormMessage.svelte";
  import { AVATAR_ACCEPT, isAvatarType } from "$lib/avatar";

  let {
    name,
    avatarURL,
    id = "avatarFile",
    onsave,
    onremove,
  }: {
    name: string;
    avatarURL: string | null;
    /** Distinguishes the file input when more than one editor is on the page. */
    id?: string;
    /** Sends the chosen image. It throws an Error with a readable message when the upload fails. */
    onsave: (file: File) => Promise<void>;
    /** Removes the saved avatar. It throws an Error with a readable message when that fails. */
    onremove: () => Promise<void>;
  } = $props();

  let selectedFile: File | null = $state(null);
  let previewURL: string | null = $state(null);
  let dragging = $state(false);
  let submitting = $state(false);
  let removing = $state(false);
  let message: FormMessageType | null = $state(null);
  let fileInput: HTMLInputElement | null = $state(null);

  function clearSelection() {
    if (previewURL) URL.revokeObjectURL(previewURL);
    selectedFile = null;
    previewURL = null;
  }

  function chooseFile(file: File | null) {
    message = null;
    if (!file) return;
    if (!isAvatarType(file.type)) {
      message = { type: "error", text: "Only PNG, JPEG or WebP images are accepted." };
      return;
    }
    clearSelection();
    selectedFile = file;
    previewURL = URL.createObjectURL(file);
  }

  function handleFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    chooseFile(input.files?.[0] ?? null);
    input.value = "";
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    dragging = true;
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    dragging = false;
    chooseFile(event.dataTransfer?.files[0] ?? null);
  }

  async function handleSave() {
    if (submitting || !selectedFile) return;

    submitting = true;
    message = null;
    try {
      await onsave(selectedFile);
      message = { type: "success", text: "Avatar updated." };
      clearSelection();
    } catch (err) {
      message = { type: "error", text: err instanceof Error ? err.message : "Upload failed." };
    } finally {
      submitting = false;
    }
  }

  async function handleRemove() {
    if (removing) return;

    removing = true;
    message = null;
    try {
      await onremove();
      message = { type: "success", text: "Avatar removed." };
      clearSelection();
    } catch (err) {
      message = { type: "error", text: err instanceof Error ? err.message : "Remove failed." };
    } finally {
      removing = false;
    }
  }

  onDestroy(() => {
    if (previewURL) URL.revokeObjectURL(previewURL);
  });
</script>

<div class="avatar-editor">
  <label class="avatar-drop" data-dragging={dragging} title="Choose an image or drop one here" ondragover={handleDragOver} ondragleave={() => (dragging = false)} ondrop={handleDrop}>
    {#if previewURL}
      <img class="preview-image" src={previewURL} alt="New avatar preview" />
    {:else}
      <UserAvatar {name} {avatarURL} size="lg" />
    {/if}
    <span class="overlay" aria-hidden="true"><Upload size={20} strokeWidth={2} /></span>
    <input bind:this={fileInput} {id} class="visually-hidden" type="file" accept={AVATAR_ACCEPT} aria-label="Avatar image" onchange={handleFileChange} />
  </label>

  <div class="controls">
    <div class="actions">
      <Button type="button" variant="secondary" size="sm" onclick={() => fileInput?.click()}><Upload size={13} strokeWidth={2} /> Upload image</Button>
      {#if avatarURL && !selectedFile}
        <Button type="button" variant="danger" size="sm" disabled={removing} onclick={handleRemove}>
          {removing ? "Removing..." : "Remove"}
        </Button>
      {/if}
    </div>
    <p class="hint">PNG, JPEG or WebP. Cropped to a 512x512 square.</p>
    {#if selectedFile}
      <div class="actions">
        <Button type="button" size="sm" disabled={submitting} onclick={handleSave}>
          {submitting ? "Saving..." : "Save avatar"}
        </Button>
        <Button type="button" variant="secondary" size="sm" disabled={submitting} onclick={clearSelection}>Cancel</Button>
      </div>
    {/if}
    <FormMessage {message} />
  </div>
</div>

<style>
  .avatar-editor {
    display: flex;
    align-items: center;
    gap: 1.25rem;
  }

  .avatar-drop {
    position: relative;
    flex: none;
    border-radius: 50%;
    cursor: pointer;

    &[data-dragging="true"] {
      outline: 2px dashed var(--colour-focus);
      outline-offset: 3px;
    }

    &:focus-within {
      outline: 2px solid var(--colour-focus);
      outline-offset: 3px;
    }
  }

  .preview-image {
    display: block;
    width: 5rem;
    height: 5rem;
    border-radius: 50%;
    object-fit: cover;
  }

  .overlay {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: rgb(from var(--colour-shadow) r g b / 0.55);
    color: white;
    opacity: 0;
    transition: opacity var(--motion-fast) var(--ease-out-quart);
  }

  .avatar-drop:hover .overlay,
  .avatar-drop:focus-within .overlay,
  .avatar-drop[data-dragging="true"] .overlay {
    opacity: 1;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }

  .controls {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    min-width: 0;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .hint {
    margin: 0;
    color: var(--colour-text-secondary);
    font-size: 0.8125rem;
  }
</style>
