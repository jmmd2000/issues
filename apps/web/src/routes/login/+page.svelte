<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import { onDestroy } from "svelte";
  import { client } from "$lib/api/client";
  import Button from "$lib/components/ui/Button.svelte";
  import FormMessage, { type FormMessage as FormMessageType } from "$lib/components/forms/FormMessage.svelte";
  import AuthShell from "$lib/components/AuthShell.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  let email = $state("");
  let password = $state("");
  let submitting = $state(false);
  let message: FormMessageType | null = $state(null);
  let fieldErrors: Record<string, string> = $state({});
  let redirectTimer: ReturnType<typeof setTimeout> | null = null;

  // Only honour same-origin paths so a malicious `?next=//attacker` can't
  // bounce the user off-site after sign-in.
  function safeNext(): string {
    const raw = page.url.searchParams.get("next");
    if (!raw) return resolve("/");
    if (!raw.startsWith("/") || raw.startsWith("//")) return resolve("/");
    return raw;
  }

  onDestroy(() => {
    if (redirectTimer) clearTimeout(redirectTimer);
  });

  async function handleSubmit() {
    if (submitting) return;
    submitting = true;
    message = null;
    fieldErrors = {};
    try {
      const res = await client.api.auth.login.$post({ json: { email, password } });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string; fieldErrors?: Record<string, string> };
        message = { type: "error", text: data.message ?? "Login failed" };
        fieldErrors = data.fieldErrors ?? {};
        return;
      }
      message = { type: "success", text: "Signed in." };
      const target = safeNext();
      await invalidateAll();
      // eslint-disable-next-line svelte/no-navigation-without-resolve
      redirectTimer = setTimeout(() => void goto(target), 1200);
    } catch {
      message = { type: "error", text: "Network error. Please try again." };
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Sign in · Issues</title>
</svelte:head>

<AuthShell title="Sign in" lede="Welcome back to your tickets.">
  <form
    novalidate
    onsubmit={e => {
      e.preventDefault();
      void handleSubmit();
    }}
  >
    <div class="field">
      <label for="email">Email</label>
      <input type="email" id="email" class="form-input" aria-invalid={fieldErrors.email ? "true" : undefined} bind:value={email} placeholder="you@example.com" required maxlength="120" />
      {#if fieldErrors.email}<span class="field-error">{fieldErrors.email}</span>{/if}
    </div>

    <div class="field">
      <label for="password">Password</label>
      <input type="password" id="password" class="form-input" aria-invalid={fieldErrors.password ? "true" : undefined} bind:value={password} placeholder="••••••••" required minlength="8" />
      {#if fieldErrors.password}<span class="field-error">{fieldErrors.password}</span>{/if}
    </div>

    <FormMessage {message} />

    <Button type="submit" disabled={submitting} fullWidth>
      {submitting ? "Signing in..." : "Sign in"}
    </Button>
  </form>

  {#if data.registrationOpen}
    <p class="alt">
      New? <a href={resolve("/register")}>Create an account</a>
    </p>
  {/if}
</AuthShell>
