<script lang="ts">
  import { onDestroy } from "svelte";
  import { invalidateAll } from "$app/navigation";
  import type { CurrentUser } from "@issues/api";
  import Button from "$lib/components/ui/Button.svelte";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import FormMessage, { type FormMessage as FormMessageType } from "./FormMessage.svelte";
  import { deleteUserAvatar, uploadUserAvatar } from "$lib/uploads";

  let { user }: { user: CurrentUser } = $props();

  let selectedFile: File | null = $state(null);
  let previewURL: string | null = $state(null);
  let submitting = $state(false);
  let removing = $state(false);
  let message: FormMessageType | null = $state(null);

  function clearSelection() {
    if (previewURL) URL.revokeObjectURL(previewURL);
    selectedFile = null;
    previewURL = null;
  }

  function handleFileChange(event: Event) {
    message = null;
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    clearSelection();
    if (file) {
      selectedFile = file;
      previewURL = URL.createObjectURL(file);
    }
  }

  async function handleSubmit() {
    if (submitting || !selectedFile) return;

    submitting = true;
    message = null;
    try {
      await uploadUserAvatar(selectedFile);
      message = { type: "success", text: "Avatar updated." };
      clearSelection();
      await invalidateAll();
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
      await deleteUserAvatar();
      message = { type: "success", text: "Avatar removed." };
      clearSelection();
      await invalidateAll();
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

<form
  class="settings-card"
  novalidate
  onsubmit={(e) => {
    e.preventDefault();
    handleSubmit();
  }}
>
  <div class="avatar-row">
    <div class="preview">
      {#if previewURL}
        <img class="preview-image" src={previewURL} alt="New avatar preview" />
      {:else}
        <UserAvatar name={user.name} avatarURL={user.avatarURL} size="lg" />
      {/if}
    </div>

    <div class="controls">
      <label for="avatarFile" class="form-label">Upload an image</label>
      <input id="avatarFile" type="file" accept="image/*" class="form-input file-input" onchange={handleFileChange} />
      <p class="hint">Cropped to a 512x512 square. PNG, JPEG, or WebP.</p>
    </div>
  </div>

  <div class="settings-card-footer">
    <FormMessage {message} />
    {#if user.avatarURL}
      <Button type="button" variant="danger" disabled={removing || submitting} onclick={handleRemove}>
        {removing ? "Removing..." : "Remove"}
      </Button>
    {/if}
    <Button type="submit" disabled={submitting || !selectedFile}>
      {submitting ? "Saving..." : "Save avatar"}
    </Button>
  </div>
</form>

<style>
  .avatar-row {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .preview {
    flex: 0 0 auto;
  }

  .preview-image {
    width: 5rem;
    height: 5rem;
    border-radius: 50%;
    object-fit: cover;
    display: block;
  }

  .controls {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .hint {
    font-size: 0.8rem;
    color: var(--colour-text-secondary);
    margin: 0;
  }

  .file-input {
    padding: 0.3em 0.5em;
  }

  .settings-card-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 1em;
    padding-top: 1em;
    border-top: var(--border);
  }

  .settings-card-footer :global(.form-message) {
    flex: 1;
  }
</style>
