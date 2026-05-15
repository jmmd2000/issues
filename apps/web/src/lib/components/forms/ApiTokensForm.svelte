<script lang="ts">
  import { client } from "$lib/api/client";
  import type { ApiToken } from "@issues/api";
  import { Copy, Plus, Trash2 } from "@lucide/svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Modal from "$lib/components/ui/Modal.svelte";
  import FormMessage, { type FormMessage as FormMessageType } from "./FormMessage.svelte";

  const EXPIRY_OPTIONS = [7, 30, 90, 180, 365] as const;
  const DEFAULT_EXPIRY = 90;

  let { tokens }: { tokens: ApiToken[] } = $props();

  // svelte-ignore state_referenced_locally
  let tokenList = $state([...tokens]);
  let form = $state({ name: "", expiresInDays: DEFAULT_EXPIRY });
  let fieldErrors: Record<string, string> = $state({});
  let message = $state<FormMessageType | null>(null);
  let submitting = $state(false);

  let revealOpen = $state(false);
  let revealedToken = $state("");
  let revealedName = $state("");
  let copied = $state(false);

  let confirmOpen = $state(false);
  let confirmTarget = $state<ApiToken | null>(null);
  let revoking = $state(false);

  function formatDate(value: string | null): string {
    if (!value) return "Never";
    return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function daysUntil(value: string): number {
    const diff = new Date(value).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  async function handleCreate() {
    if (submitting) return;

    submitting = true;
    fieldErrors = {};
    message = null;
    try {
      const res = await client.api.auth.tokens.$post({ json: { name: form.name, expiresInDays: form.expiresInDays } });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string; fieldErrors?: Record<string, string> };
        message = { type: "error", text: data.message ?? "Failed to create token." };
        fieldErrors = data.fieldErrors ?? {};
        return;
      }
      const data = (await res.json()) as { token: string; apiToken: ApiToken };
      tokenList = [data.apiToken, ...tokenList];
      revealedToken = data.token;
      revealedName = data.apiToken.name;
      revealOpen = true;
      copied = false;
      form = { name: "", expiresInDays: DEFAULT_EXPIRY };
    } catch {
      message = { type: "error", text: "Network error. Please try again." };
    } finally {
      submitting = false;
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(revealedToken);
      copied = true;
    } catch {
      copied = false;
    }
  }

  function dismissReveal() {
    revealOpen = false;
    revealedToken = "";
    revealedName = "";
    copied = false;
  }

  function requestRevoke(token: ApiToken) {
    confirmTarget = token;
    confirmOpen = true;
  }

  async function confirmRevoke() {
    if (!confirmTarget || revoking) return;

    revoking = true;
    try {
      const res = await client.api.auth.tokens[":id"].$delete({ param: { id: confirmTarget.id } });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        message = { type: "error", text: data.message ?? "Failed to revoke token." };
        confirmOpen = false;
        return;
      }
      tokenList = tokenList.filter((token) => token.id !== confirmTarget!.id);
      confirmOpen = false;
      confirmTarget = null;
    } catch {
      message = { type: "error", text: "Network error. Please try again." };
      confirmOpen = false;
    } finally {
      revoking = false;
    }
  }
</script>

<div class="settings-card">
  {#if tokenList.length === 0}
    <p class="empty">No tokens yet. Create one below to authenticate the MCP server.</p>
  {:else}
    <ul class="token-list">
      {#each tokenList as token (token.id)}
        {@const remaining = daysUntil(token.expiresAt)}
        <li class="token-row">
          <div class="token-info">
            <span class="token-name">{token.name}</span>
            <span class="token-meta">
              Created {formatDate(token.createdAt)}
              {" · Last used "}{formatDate(token.lastUsedAt)}
              {" · "}
              <span class="expiry" data-warning={remaining <= 14}>
                {remaining > 0 ? `Expires in ${remaining} days` : "Expired"}
              </span>
            </span>
          </div>
          <button type="button" class="revoke-button" aria-label={`Revoke token ${token.name}`} onclick={() => requestRevoke(token)}>
            <Trash2 size="16" color="var(--colour-error)" />
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <form
    class="create-row"
    novalidate
    onsubmit={(e) => {
      e.preventDefault();
      handleCreate();
    }}
  >
    <input type="text" id="token-name" class="form-input" bind:value={form.name} placeholder="Token name, e.g. Claude Code" required maxlength="80" disabled={submitting} />
    <select id="token-expiry" class="form-input expiry-select" bind:value={form.expiresInDays} disabled={submitting}>
      {#each EXPIRY_OPTIONS as days (days)}
        <option value={days}>{days} days</option>
      {/each}
    </select>
    <Button type="submit" size="md" disabled={submitting}>
      <Plus size="14" />
      {submitting ? "Creating..." : "Create token"}
    </Button>
  </form>

  <div class="field-errors">
    {#each Object.entries(fieldErrors) as [field, error] (field)}
      <span class="field-error">{error}</span>
    {/each}
  </div>
  <FormMessage {message} />
</div>

<Modal open={revealOpen} title={`Token "${revealedName}" created`} onclose={dismissReveal} maxWidth="36rem">
  <div class="reveal-body">
    <p class="reveal-warning">Copy this token now — you will not be able to see it again.</p>
    <div class="reveal-token">
      <code>{revealedToken}</code>
      <button type="button" class="copy-button" onclick={handleCopy} aria-label="Copy token">
        <Copy size="14" />
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  </div>
  {#snippet footer()}
    <Button type="button" onclick={dismissReveal}>Done</Button>
  {/snippet}
</Modal>

<Modal open={confirmOpen} title={`Revoke "${confirmTarget?.name ?? ""}"?`} onclose={() => (confirmOpen = false)} maxWidth="28rem">
  <p class="confirm-body">Any client using this token will immediately stop working. This cannot be undone.</p>
  {#snippet footer()}
    <Button type="button" variant="secondary" onclick={() => (confirmOpen = false)} disabled={revoking}>Cancel</Button>
    <Button type="button" variant="danger" onclick={() => void confirmRevoke()} disabled={revoking}>
      {revoking ? "Revoking..." : "Revoke token"}
    </Button>
  {/snippet}
</Modal>

<style>
  .settings-card {
    gap: 1em;
  }

  .empty {
    margin: 0;
    color: var(--colour-text-secondary);
    font-size: 0.9em;
  }

  .token-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.5em;
  }

  .token-row {
    display: flex;
    align-items: center;
    gap: 0.75em;
    padding: 0.75em 1em;
    background-color: var(--colour-bg);
    border: var(--border);
    border-radius: var(--border-radius-inner);
  }

  .token-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2em;
  }

  .token-name {
    font-weight: 500;
    color: var(--colour-text);
  }

  .token-meta {
    font-size: 0.8em;
    color: var(--colour-text-secondary);
  }

  .expiry[data-warning="true"] {
    color: var(--colour-error);
    font-weight: 500;
  }

  .revoke-button {
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--colour-error-bg);
    border: var(--border);
    border-color: var(--colour-error-border);
    padding: 0.4em 0.6em;
    height: 2em;
    border-radius: var(--border-radius-inner);
    cursor: pointer;
    transition: background-color var(--motion-fast) var(--ease-out-quart);

    &:hover {
      background-color: var(--colour-error-bg-hover);
    }

    &:focus {
      outline: 2px solid var(--colour-error);
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.7;
    }
  }

  .create-row {
    display: flex;
    align-items: center;
    gap: 0.75em;
    padding-top: 1em;
    border-top: var(--border);
  }

  .create-row .form-input {
    flex: 1;
  }

  .expiry-select {
    flex: 0 0 auto;
    width: auto;
    cursor: pointer;
  }

  .reveal-body {
    display: flex;
    flex-direction: column;
    gap: 1em;
  }

  .reveal-warning {
    margin: 0;
    padding: 0.75em 1em;
    background-color: var(--colour-error-bg);
    border: var(--border);
    border-color: var(--colour-error-border);
    border-radius: var(--border-radius-inner);
    color: var(--colour-error);
    font-size: 0.9em;
  }

  .reveal-token {
    display: flex;
    gap: 0.5em;
    align-items: stretch;
  }

  .reveal-token code {
    flex: 1;
    padding: 0.6em 0.8em;
    background-color: var(--colour-bg);
    border: var(--border);
    border-radius: var(--border-radius-inner);
    font-family: "JetBrains Mono", monospace;
    font-size: 0.85em;
    word-break: break-all;
    user-select: all;
  }

  .copy-button {
    display: flex;
    align-items: center;
    gap: 0.4em;
    padding: 0.5em 0.8em;
    background-color: var(--colour-bg-lighter);
    border: var(--border);
    border-radius: var(--border-radius-inner);
    font-size: 0.85em;
    font-weight: 500;
    cursor: pointer;

    &:hover {
      background-color: var(--colour-bg-hover);
    }
  }

  .confirm-body {
    margin: 0;
    color: var(--colour-text);
    font-size: 0.9rem;
    line-height: 1.5;
  }
</style>
