<script lang="ts">
  import "$lib/styles/form.css";
  import { goto, invalidateAll } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { onDestroy } from "svelte";
  import { client } from "$lib/api/client";
  import Button from "$lib/components/ui/Button.svelte";
  import FormMessage, { type FormMessage as FormMessageType } from "$lib/components/forms/FormMessage.svelte";

  let email: string = $state("");
  let password: string = $state("");
  let submitting = $state(false);
  let message: FormMessageType | null = $state(null);
  let fieldErrors: Record<string, string> = $state({});
  let redirectTimer: ReturnType<typeof setTimeout> | null = null;

  onDestroy(() => {
    if (redirectTimer) clearTimeout(redirectTimer);
  });

  async function handleSubmit() {
    if (submitting) return;

    submitting = true;
    message = null;
    fieldErrors = {};
    try {
      const res = await client.api.auth.login.$post({
        json: { email, password },
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string; fieldErrors?: Record<string, string> };
        message = { type: "error", text: data.message ?? "Login failed" };
        fieldErrors = data.fieldErrors ?? {};
        return;
      }
      message = { type: "success", text: "Login successful!" };
      await invalidateAll();
      redirectTimer = setTimeout(() => goto(resolve("/")), 1500);
    } catch {
      message = { type: "error", text: "Network error. Please try again." };
    } finally {
      submitting = false;
    }
  }
</script>

<div class="form-container">
  <form
    onsubmit={(e) => {
      e.preventDefault();
      handleSubmit();
    }}
    class="form-card"
    novalidate
  >
    <h1 class="form-header">Login</h1>
    <div class="input-row">
      <label for="email" class="form-label">Email</label>
      <input type="email" id="email" class="form-input" bind:value={email} placeholder="Enter email..." required maxlength="120" />
      {#if fieldErrors.email}
        <span id="email-error" class="field-error">{fieldErrors.email}</span>
      {/if}
    </div>
    <div class="input-row">
      <label for="password" class="form-label">Password</label>
      <input type="password" id="password" class="form-input" minlength="8" bind:value={password} placeholder="Enter password..." required />
      {#if fieldErrors.password}
        <span id="password-error" class="field-error">{fieldErrors.password}</span>
      {/if}
    </div>
    <FormMessage {message} />
    <Button type="submit" disabled={submitting} fullWidth>
      {submitting ? "Logging in..." : "Login"}
    </Button>
  </form>
</div>
