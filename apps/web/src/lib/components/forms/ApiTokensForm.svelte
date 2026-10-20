<script lang="ts">
  import type { ApiToken } from "@issues/api";
  import { Copy, Plus } from "@lucide/svelte";
  import { DEFAULT_EXPIRY_DAYS, EXPIRY_CHOICES, daysLeft, expiryLabel } from "$lib/tokens";
  import Button from "$lib/components/ui/Button.svelte";
  import SegmentedControl, { type SegmentedOption } from "$lib/components/ui/SegmentedControl.svelte";
  import FormMessage, { type FormMessage as FormMessageType } from "./FormMessage.svelte";

  type CreateResult = { ok: true; token: string; apiToken: ApiToken } | { ok: false; message?: string; fieldErrors?: Record<string, string> };
  type RevokeResult = { ok: true } | { ok: false; message?: string };

  let {
    tokens,
    onCreate,
    onRevoke,
    placeholder = "Token name, e.g. Claude Code",
    emptyText = "No tokens yet. Create one below to authenticate the MCP server.",
  }: {
    tokens: ApiToken[];
    onCreate: (name: string, expiresInDays: number) => Promise<CreateResult>;
    onRevoke: (id: string) => Promise<RevokeResult>;
    placeholder?: string;
    emptyText?: string;
  } = $props();

  const expiryOptions: SegmentedOption<string>[] = EXPIRY_CHOICES.map(days => ({ value: String(days), label: `${days} days` }));

  // svelte-ignore state_referenced_locally
  let tokenList = $state([...tokens]);
  let name = $state("");
  let expiry = $state(String(DEFAULT_EXPIRY_DAYS));
  let fieldErrors: Record<string, string> = $state({});
  let message = $state<FormMessageType | null>(null);
  let submitting = $state(false);

  let revealed = $state<{ id: string; name: string; value: string }[]>([]);
  let copiedID = $state<string | null>(null);

  let confirmingID = $state<string | null>(null);
  let revoking = $state(false);

  const canCreate = $derived(name.trim().length > 0 && !submitting);

  function formatDate(value: string | null): string {
    if (!value) return "Never";
    return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  async function handleCreate() {
    if (!canCreate) return;

    submitting = true;
    fieldErrors = {};
    message = null;
    try {
      const result = await onCreate(name.trim(), Number(expiry));
      if (!result.ok) {
        message = { type: "error", text: result.message ?? "Failed to create token." };
        fieldErrors = result.fieldErrors ?? {};
        return;
      }
      tokenList = [result.apiToken, ...tokenList];
      revealed = [{ id: result.apiToken.id, name: result.apiToken.name, value: result.token }, ...revealed];
      name = "";
      expiry = String(DEFAULT_EXPIRY_DAYS);
    } catch {
      message = { type: "error", text: "Network error. Please try again." };
    } finally {
      submitting = false;
    }
  }

  async function handleCopy(item: { id: string; value: string }) {
    try {
      await navigator.clipboard.writeText(item.value);
      copiedID = item.id;
    } catch {
      copiedID = null;
    }
  }

  function dismiss(id: string) {
    revealed = revealed.filter(item => item.id !== id);
  }

  async function confirmRevoke(token: ApiToken) {
    if (revoking) return;

    revoking = true;
    message = null;
    try {
      const result = await onRevoke(token.id);
      if (!result.ok) {
        message = { type: "error", text: result.message ?? "Failed to revoke token." };
        return;
      }
      tokenList = tokenList.filter(item => item.id !== token.id);
      confirmingID = null;
    } catch {
      message = { type: "error", text: "Network error. Please try again." };
    } finally {
      revoking = false;
    }
  }
</script>

<div class="tokens">
  {#each revealed as item (item.id)}
    <div class="reveal" role="status">
      <div class="reveal-title">Copy the token for {item.name} now. It is not shown again.</div>
      <div class="reveal-token">
        <code>{item.value}</code>
        <Button type="button" variant="secondary" size="sm" onclick={() => void handleCopy(item)}><Copy size={13} strokeWidth={2} /> {copiedID === item.id ? "Copied" : "Copy"}</Button>
      </div>
      <Button type="button" variant="secondary" size="sm" onclick={() => dismiss(item.id)}>Dismiss</Button>
    </div>
  {/each}

  {#if tokenList.length === 0}
    <p class="empty">{emptyText}</p>
  {:else}
    <ul class="token-list">
      {#each tokenList as token (token.id)}
        {@const expiryInfo = expiryLabel(daysLeft(token.expiresAt))}
        <li class="token-row">
          <div class="token-info">
            <span class="token-name">{token.name}</span>
            <span class="token-meta">Created {formatDate(token.createdAt)} · Last used {formatDate(token.lastUsedAt)}</span>
          </div>
          <span class="expiry" data-tone={expiryInfo.tone}>{expiryInfo.text}</span>
          {#if confirmingID === token.id}
            <span class="confirm">
              <span>Revoke {token.name}?</span>
              <Button type="button" variant="danger" size="sm" disabled={revoking} onclick={() => void confirmRevoke(token)}>{revoking ? "Revoking..." : "Revoke"}</Button>
              <Button type="button" variant="secondary" size="sm" disabled={revoking} onclick={() => (confirmingID = null)}>Cancel</Button>
            </span>
          {:else}
            <Button type="button" variant="secondary" size="sm" aria-label={`Revoke token ${token.name}`} onclick={() => (confirmingID = token.id)}>Revoke</Button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  <form
    class="create"
    novalidate
    onsubmit={e => {
      e.preventDefault();
      void handleCreate();
    }}
  >
    <div class="field">
      <label for="token-name" class="form-label">Name</label>
      <input type="text" id="token-name" class="form-input" bind:value={name} {placeholder} maxlength="80" disabled={submitting} />
    </div>
    <div class="field">
      <span class="form-label">Expires after</span>
      <SegmentedControl bind:value={expiry} options={expiryOptions} label="Expires after" size="sm" disabled={submitting} />
    </div>
    <div class="create-footer">
      <Button type="submit" disabled={!canCreate}>
        <Plus size={14} />
        {submitting ? "Creating..." : "Create token"}
      </Button>
      <FormMessage {message} />
    </div>
  </form>

  <div class="field-errors">
    {#each Object.entries(fieldErrors) as [field, error] (field)}
      <span class="field-error">{error}</span>
    {/each}
  </div>
</div>

<style>
  .tokens {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .empty {
    margin: 0;
    color: var(--colour-text-secondary);
    font-size: 0.9em;
  }

  .reveal {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border: 1px solid var(--colour-success-border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-success-bg);
  }

  .reveal-title {
    font-size: 0.875rem;
    font-weight: 600;
  }

  .reveal-token {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    max-width: 100%;

    & code {
      min-width: 0;
      padding: 0.35rem 0.6rem;
      border: var(--border);
      border-radius: var(--border-radius-inner);
      background: var(--colour-bg-lighter);
      font-family: var(--font-mono);
      font-size: 0.8125rem;
      overflow-wrap: anywhere;
    }
  }

  .token-list {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .token-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 0.25rem 1rem;
    align-items: center;
    padding: 0.625rem 0;
    border-top: var(--border);

    &:first-child {
      border-top: 0;
      padding-top: 0;
    }
  }

  .token-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .token-name {
    font-weight: 500;
  }

  .token-meta {
    color: var(--colour-text-secondary);
    font-size: 0.8125rem;
  }

  .expiry {
    color: var(--colour-muted);
    font-size: 0.8125rem;
    white-space: nowrap;

    &[data-tone="soon"] {
      color: var(--colour-warning);
      font-weight: 600;
    }

    &[data-tone="expired"] {
      color: var(--colour-error);
      font-weight: 600;
    }
  }

  .confirm {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .create {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-top: 1rem;
    border-top: var(--border);
  }

  .field {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.375rem;

    & .form-input {
      max-width: 24rem;
    }
  }

  .create-footer {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  @media (max-width: 40rem) {
    .token-row {
      grid-template-columns: minmax(0, 1fr) auto;

      & .expiry {
        grid-row: 2;
      }
    }
  }
</style>
