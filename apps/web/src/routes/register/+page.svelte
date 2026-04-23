<script lang="ts">
  import "$lib/styles/form.css";
  import { resolve } from "$app/paths";
  import { goto, invalidateAll } from "$app/navigation";
  import { onDestroy } from "svelte";
  import { client } from "$lib/api/client";
  import type { PageProps } from "./$types";
  import Button from "$lib/components/ui/Button.svelte";
  import FormMessage, { type FormMessage as FormMessageType } from "$lib/components/forms/FormMessage.svelte";

  let { data }: PageProps = $props();

  let name: string = $state("");
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
      const res = await client.api.auth.register.$post({
        json: { name, email, password },
      });
      if (!res.ok) {
        const errorData = (await res.json()) as { message?: string; fieldErrors?: Record<string, string> };
        message = { type: "error", text: errorData.message ?? "Registration failed" };
        fieldErrors = errorData.fieldErrors ?? {};
        return;
      }
      message = { type: "success", text: "Registration successful!" };
      await invalidateAll();
      redirectTimer = setTimeout(() => goto(resolve("/login")), 1500);
    } catch {
      message = { type: "error", text: "Network error. Please try again." };
    } finally {
      submitting = false;
    }
  }
</script>

<div class="form-container">
  {#if !data.open}
    <div class="closed-message">
      <p>Registration is currently closed.</p>
    </div>
  {:else}
    <form
      onsubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      class="form-card"
      novalidate
    >
      <h1 class="form-header">Register user</h1>
      <div class="input-row">
        <label for="name" class="form-label">Name</label>
        <input type="text" id="name" class="form-input" bind:value={name} placeholder="Enter name..." required maxlength="25" />
        {#if fieldErrors.name}
          <span id="name-error" class="field-error">{fieldErrors.name}</span>
        {/if}
      </div>
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
        {submitting ? "Registering..." : "Register"}
      </Button>
    </form>
  {/if}
</div>

<style>
  .closed-message {
    padding: 2em;
    border: var(--border);
    border-radius: var(--border-radius-outer);
    background-color: var(--colour-bg-lighter);
    box-shadow: var(--box-shadow);
  }
</style>
