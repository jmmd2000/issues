<script lang="ts">
  import { onDestroy } from "svelte";
  import type { ApiToken, ServiceUser } from "@issues/api";
  import { ChevronDown, Plus } from "@lucide/svelte";
  import { client } from "$lib/api/client";
  import { deleteServiceUserAvatar, uploadServiceUserAvatar } from "$lib/uploads";
  import Button from "$lib/components/ui/Button.svelte";
  import Modal from "$lib/components/ui/Modal.svelte";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import FormMessage, { type FormMessage as FormMessageType } from "./FormMessage.svelte";
  import ApiTokensForm from "./ApiTokensForm.svelte";

  let { serviceUsers }: { serviceUsers: ServiceUser[] } = $props();

  // svelte-ignore state_referenced_locally
  let users = $state([...serviceUsers]);
  let tokensByUser = $state<Record<string, ApiToken[]>>({});
  let expandedUserID = $state<string | null>(null);
  let tokensLoading = $state<string | null>(null);

  let createOpen = $state(false);
  let newName = $state("");
  let creating = $state(false);
  let createMessage = $state<FormMessageType | null>(null);
  let createFieldErrors: Record<string, string> = $state({});

  let pendingAvatarFile = $state<Record<string, File | null>>({});
  let pendingAvatarPreview = $state<Record<string, string | null>>({});
  let avatarSaving = $state<string | null>(null);
  let avatarMessage = $state<Record<string, FormMessageType | null>>({});

  function formatDate(value: string): string {
    return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  async function toggleExpand(userID: string) {
    if (expandedUserID === userID) {
      expandedUserID = null;
      return;
    }
    expandedUserID = userID;
    if (tokensByUser[userID]) return;

    tokensLoading = userID;
    try {
      const res = await client.api.users.service[":id"].tokens.$get({ param: { id: userID } });
      if (res.ok) {
        const body = (await res.json()) as { apiTokens: ApiToken[] };
        tokensByUser = { ...tokensByUser, [userID]: body.apiTokens };
      } else {
        tokensByUser = { ...tokensByUser, [userID]: [] };
      }
    } finally {
      tokensLoading = null;
    }
  }

  function openCreate() {
    newName = "";
    createMessage = null;
    createFieldErrors = {};
    createOpen = true;
  }

  async function submitCreate() {
    if (creating) return;
    creating = true;
    createFieldErrors = {};
    createMessage = null;
    try {
      const res = await client.api.users.service.$post({ json: { name: newName } });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string; fieldErrors?: Record<string, string> };
        createMessage = { type: "error", text: body.message ?? "Failed to create service user." };
        createFieldErrors = body.fieldErrors ?? {};
        return;
      }
      const body = (await res.json()) as { user: ServiceUser };
      users = [...users, body.user];
      createOpen = false;
    } catch {
      createMessage = { type: "error", text: "Network error. Please try again." };
    } finally {
      creating = false;
    }
  }

  function createTokenFor(userID: string) {
    return async (name: string, expiresInDays: number) => {
      const res = await client.api.users.service[":id"].tokens.$post({ param: { id: userID }, json: { name, expiresInDays } });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string; fieldErrors?: Record<string, string> };
        return { ok: false as const, message: body.message, fieldErrors: body.fieldErrors };
      }
      const body = (await res.json()) as { token: string; apiToken: ApiToken };
      tokensByUser = { ...tokensByUser, [userID]: [body.apiToken, ...(tokensByUser[userID] ?? [])] };
      return { ok: true as const, token: body.token, apiToken: body.apiToken };
    };
  }

  function revokeTokenFor(userID: string) {
    return async (tokenID: string) => {
      const res = await client.api.users.service[":id"].tokens[":tokenID"].$delete({ param: { id: userID, tokenID } });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        return { ok: false as const, message: body.message };
      }
      tokensByUser = { ...tokensByUser, [userID]: (tokensByUser[userID] ?? []).filter((token) => token.id !== tokenID) };
      return { ok: true as const };
    };
  }

  function clearAvatarSelection(userID: string) {
    const previousURL = pendingAvatarPreview[userID];
    if (previousURL) URL.revokeObjectURL(previousURL);
    pendingAvatarFile = { ...pendingAvatarFile, [userID]: null };
    pendingAvatarPreview = { ...pendingAvatarPreview, [userID]: null };
  }

  function handleAvatarChange(userID: string, event: Event) {
    avatarMessage = { ...avatarMessage, [userID]: null };
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    clearAvatarSelection(userID);
    if (file) {
      pendingAvatarFile = { ...pendingAvatarFile, [userID]: file };
      pendingAvatarPreview = { ...pendingAvatarPreview, [userID]: URL.createObjectURL(file) };
    }
  }

  async function saveAvatar(userID: string) {
    const file = pendingAvatarFile[userID];
    if (!file || avatarSaving) return;
    avatarSaving = userID;
    avatarMessage = { ...avatarMessage, [userID]: null };
    try {
      const updated = await uploadServiceUserAvatar(userID, file);
      users = users.map((user) => (user.id === userID ? { ...user, avatarURL: updated.avatarURL } : user));
      clearAvatarSelection(userID);
      avatarMessage = { ...avatarMessage, [userID]: { type: "success", text: "Avatar updated." } };
    } catch (err) {
      avatarMessage = { ...avatarMessage, [userID]: { type: "error", text: err instanceof Error ? err.message : "Upload failed." } };
    } finally {
      avatarSaving = null;
    }
  }

  async function removeAvatar(userID: string) {
    if (avatarSaving) return;
    avatarSaving = userID;
    avatarMessage = { ...avatarMessage, [userID]: null };
    try {
      await deleteServiceUserAvatar(userID);
      users = users.map((user) => (user.id === userID ? { ...user, avatarURL: null } : user));
      clearAvatarSelection(userID);
      avatarMessage = { ...avatarMessage, [userID]: { type: "success", text: "Avatar removed." } };
    } catch (err) {
      avatarMessage = { ...avatarMessage, [userID]: { type: "error", text: err instanceof Error ? err.message : "Remove failed." } };
    } finally {
      avatarSaving = null;
    }
  }

  onDestroy(() => {
    for (const url of Object.values(pendingAvatarPreview)) {
      if (url) URL.revokeObjectURL(url);
    }
  });
</script>

<div class="settings-card">
  {#if users.length === 0}
    <p class="empty">No service users yet. Create one to attribute API activity to a bot account.</p>
  {:else}
    <ul class="user-list">
      {#each users as user (user.id)}
        {@const expanded = expandedUserID === user.id}
        {@const previewURL = pendingAvatarPreview[user.id]}
        {@const pendingFile = pendingAvatarFile[user.id]}
        <li class="user-row">
          <button type="button" class="user-header" aria-expanded={expanded} onclick={() => toggleExpand(user.id)}>
            <UserAvatar name={user.name} avatarURL={user.avatarURL} size="sm" />
            <div class="user-info">
              <span class="user-name">{user.name}</span>
              <span class="user-meta">Created {formatDate(user.createdAt)}</span>
            </div>
            <span class="chevron" data-expanded={expanded}>
              <ChevronDown size="16" />
            </span>
          </button>
          {#if expanded}
            <div class="user-body">
              <div class="avatar-row">
                <div class="avatar-preview">
                  {#if previewURL}
                    <img class="preview-image" src={previewURL} alt="New avatar preview" />
                  {:else}
                    <UserAvatar name={user.name} avatarURL={user.avatarURL} size="lg" />
                  {/if}
                </div>
                <div class="avatar-controls">
                  <label for={`avatar-${user.id}`} class="form-label">Avatar</label>
                  <input id={`avatar-${user.id}`} type="file" accept="image/*" class="form-input file-input" disabled={avatarSaving === user.id} onchange={(event) => handleAvatarChange(user.id, event)} />
                  <p class="hint">Cropped to 512x512. PNG, JPEG, or WebP.</p>
                  <div class="avatar-actions">
                    <FormMessage message={avatarMessage[user.id] ?? null} />
                    {#if user.avatarURL}
                      <Button type="button" variant="danger" size="sm" disabled={avatarSaving === user.id} onclick={() => removeAvatar(user.id)}>
                        {avatarSaving === user.id ? "Removing..." : "Remove"}
                      </Button>
                    {/if}
                    <Button type="button" size="sm" disabled={!pendingFile || avatarSaving === user.id} onclick={() => saveAvatar(user.id)}>
                      {avatarSaving === user.id && pendingFile ? "Saving..." : "Save avatar"}
                    </Button>
                  </div>
                </div>
              </div>
              {#if tokensLoading === user.id && !tokensByUser[user.id]}
                <p class="loading">Loading tokens...</p>
              {:else}
                <ApiTokensForm
                  tokens={tokensByUser[user.id] ?? []}
                  onCreate={createTokenFor(user.id)}
                  onRevoke={revokeTokenFor(user.id)}
                  placeholder="Token name, e.g. MCP local"
                  emptyText="No tokens yet. Mint one to give this service user API access."
                />
              {/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  <div class="create-row">
    <Button type="button" size="md" onclick={openCreate}>
      <Plus size="14" />
      Create service user
    </Button>
  </div>
</div>

<Modal open={createOpen} title="Create service user" onclose={() => (createOpen = false)} maxWidth="28rem">
  <form
    class="create-form"
    novalidate
    onsubmit={(event) => {
      event.preventDefault();
      submitCreate();
    }}
  >
    <label class="field">
      <span class="field-label">Display name</span>
      <input type="text" class="form-input" bind:value={newName} placeholder="e.g. Claude" maxlength="80" required disabled={creating} />
      {#if createFieldErrors.name}
        <span class="field-error">{createFieldErrors.name}</span>
      {/if}
    </label>
    <p class="hint">Shown as the reporter on tickets, comments, and activity created with this account's tokens.</p>
    <FormMessage message={createMessage} />
  </form>
  {#snippet footer()}
    <Button type="button" variant="secondary" onclick={() => (createOpen = false)} disabled={creating}>Cancel</Button>
    <Button type="button" onclick={submitCreate} disabled={creating}>
      {creating ? "Creating..." : "Create"}
    </Button>
  {/snippet}
</Modal>

<style>
  .settings-card {
    display: flex;
    flex-direction: column;
    gap: 1em;
  }

  .empty {
    margin: 0;
    color: var(--colour-text-secondary);
    font-size: 0.9em;
  }

  .user-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.5em;
  }

  .user-row {
    background-color: var(--colour-bg);
    border: var(--border);
    border-radius: var(--border-radius-inner);
    overflow: hidden;
  }

  .user-header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75em;
    padding: 0.75em 1em;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    color: inherit;
  }

  .user-header:hover {
    background-color: var(--colour-bg-hover);
  }

  .user-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2em;
  }

  .user-name {
    font-weight: 500;
    color: var(--colour-text);
  }

  .user-meta {
    font-size: 0.8em;
    color: var(--colour-text-secondary);
  }

  .chevron {
    display: flex;
    align-items: center;
    transition: transform var(--motion-fast) var(--ease-out-quart);
    color: var(--colour-text-secondary);
  }

  .chevron[data-expanded="true"] {
    transform: rotate(180deg);
  }

  .user-body {
    padding: 1em;
    border-top: var(--border);
    display: flex;
    flex-direction: column;
    gap: 1em;
  }

  .avatar-row {
    display: flex;
    align-items: center;
    gap: 1.25em;
    padding-bottom: 1em;
    border-bottom: var(--border);
  }

  .avatar-preview {
    flex: 0 0 auto;
  }

  .preview-image {
    width: 5rem;
    height: 5rem;
    border-radius: 50%;
    object-fit: cover;
    display: block;
  }

  .avatar-controls {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5em;
  }

  .file-input {
    padding: 0.3em 0.5em;
  }

  .hint {
    margin: 0;
    font-size: 0.8em;
    color: var(--colour-text-secondary);
  }

  .avatar-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75em;
    margin-top: 0.5em;
  }

  .avatar-actions :global(.form-message) {
    flex: 1;
  }

  .loading {
    margin: 0;
    color: var(--colour-text-secondary);
    font-size: 0.9em;
  }

  .create-row {
    display: flex;
    justify-content: flex-start;
    padding-top: 0.5em;
  }

  .create-form {
    display: flex;
    flex-direction: column;
    gap: 1em;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.4em;
  }

  .field-label {
    font-size: 0.85em;
    font-weight: 500;
    color: var(--colour-text-secondary);
  }

  .field-error {
    color: var(--colour-error);
    font-size: 0.8em;
  }

  .hint {
    margin: 0;
    font-size: 0.85em;
    color: var(--colour-text-secondary);
    line-height: 1.4;
  }
</style>
