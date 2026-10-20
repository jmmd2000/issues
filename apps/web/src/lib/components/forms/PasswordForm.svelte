<script lang="ts">
  import { Check } from "@lucide/svelte";
  import { client } from "$lib/api/client";
  import { canChangePassword, checkNewPassword } from "$lib/passwordRules";
  import Button from "$lib/components/ui/Button.svelte";
  import FormMessage, { type FormMessage as FormMessageType } from "./FormMessage.svelte";
  import PasswordField from "./PasswordField.svelte";

  let form = $state({ currentPassword: "", newPassword: "", confirmPassword: "" });
  let message = $state<FormMessageType | null>(null);
  let fieldErrors: Record<string, string> = $state({});
  let submitting = $state(false);

  const checks = $derived(checkNewPassword(form.newPassword, form.confirmPassword));
  const canSubmit = $derived(canChangePassword(form.currentPassword, form.newPassword, form.confirmPassword));

  function resetForm() {
    form = { currentPassword: "", newPassword: "", confirmPassword: "" };
  }

  async function handleSubmit() {
    if (submitting || !canSubmit) return;

    message = null;
    fieldErrors = {};
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
  onsubmit={e => {
    e.preventDefault();
    void handleSubmit();
  }}
>
  <PasswordField id="currentPassword" label="Current password" autocomplete="current-password" bind:value={form.currentPassword} error={fieldErrors.currentPassword} />
  <PasswordField id="newPassword" label="New password" autocomplete="new-password" bind:value={form.newPassword} error={fieldErrors.newPassword} />
  <PasswordField id="confirmPassword" label="Confirm new password" autocomplete="new-password" bind:value={form.confirmPassword} error={fieldErrors.confirmPassword} />

  <ul class="requirements" aria-label="Password requirements">
    <li class="requirement" data-met={checks.longEnough}><span class="tick" aria-hidden="true"><Check size={9} strokeWidth={4} /></span>At least 8 characters</li>
    <li class="requirement" data-met={checks.matches}><span class="tick" aria-hidden="true"><Check size={9} strokeWidth={4} /></span>Both new passwords match</li>
  </ul>

  <div class="footer">
    <Button type="submit" disabled={submitting || !canSubmit}>
      {submitting ? "Saving..." : "Update password"}
    </Button>
    <FormMessage {message} />
  </div>
</form>

<style>
  .requirements {
    display: grid;
    gap: 0.25rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .requirement {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--colour-muted);
    font-size: 0.8125rem;

    &[data-met="true"] {
      color: var(--colour-success);
    }
  }

  .tick {
    display: inline-grid;
    flex: none;
    place-items: center;
    width: 0.875rem;
    height: 0.875rem;
    border: 1.5px solid currentColor;
    border-radius: 50%;
    transition: background var(--motion-fast) var(--ease-out-quart);

    & :global(svg) {
      color: var(--colour-bg-lighter);
      opacity: 0;
    }
  }

  .requirement[data-met="true"] .tick {
    background: currentColor;

    & :global(svg) {
      opacity: 1;
    }
  }

  .footer {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
</style>
