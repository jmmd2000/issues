<script lang="ts">
  import { client } from "$lib/api/client";
  import Button from "$lib/components/ui/Button.svelte";
  import FormMessage, { type FormMessage as FormMessageType } from "./FormMessage.svelte";

  let form = $state({ currentPassword: "", newPassword: "", confirmPassword: "" });
  let message = $state<FormMessageType | null>(null);
  let fieldErrors: Record<string, string> = $state({});
  let submitting = $state(false);

  function resetForm() {
    form = { currentPassword: "", newPassword: "", confirmPassword: "" };
  }

  async function handleSubmit() {
    if (submitting) return;

    message = null;
    fieldErrors = {};

    if (form.newPassword !== form.confirmPassword) {
      fieldErrors = { confirmPassword: "Passwords do not match." };
      return;
    }

    submitting = true;
    try {
      const res = await client.api.auth["change-password"].$post({
        json: { currentPassword: form.currentPassword, newPassword: form.newPassword },
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string; fieldErrors?: Record<string, string> };
        message = { type: "error", text: data.message ?? "Failed to update password." };
        fieldErrors = data.fieldErrors ?? {};
        return;
      }
      message = { type: "success", text: "Password updated." };
      resetForm();
    } catch {
      message = { type: "error", text: "Network error. Please try again." };
    } finally {
      submitting = false;
    }
  }
</script>

<form
  class="settings-card"
  novalidate
  onsubmit={(e) => {
    e.preventDefault();
    handleSubmit();
  }}
>
  <div>
    <label for="currentPassword" class="form-label">Current password</label>
    <input
      type="password"
      id="currentPassword"
      class="form-input"
      bind:value={form.currentPassword}
      autocomplete="current-password"
      required
    />
    {#if fieldErrors.currentPassword}
      <span id="currentPassword-error" class="field-error">{fieldErrors.currentPassword}</span>
    {/if}
  </div>

  <div>
    <label for="newPassword" class="form-label">New password</label>
    <input
      type="password"
      id="newPassword"
      class="form-input"
      bind:value={form.newPassword}
      autocomplete="new-password"
      minlength="8"
      required
    />
    {#if fieldErrors.newPassword}
      <span id="newPassword-error" class="field-error">{fieldErrors.newPassword}</span>
    {/if}
  </div>

  <div>
    <label for="confirmPassword" class="form-label">Confirm new password</label>
    <input
      type="password"
      id="confirmPassword"
      class="form-input"
      bind:value={form.confirmPassword}
      autocomplete="new-password"
      minlength="8"
      required
    />
    {#if fieldErrors.confirmPassword}
      <span id="confirmPassword-error" class="field-error">{fieldErrors.confirmPassword}</span>
    {/if}
  </div>

  <div class="settings-card-footer">
    <FormMessage {message} />
    <Button type="submit" disabled={submitting}>
      {submitting ? "Saving..." : "Update password"}
    </Button>
  </div>
</form>

<style>
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
