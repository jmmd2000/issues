<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { onDestroy } from "svelte";
  import { client } from "$lib/api/client";
  import type { PageProps } from "./$types";
  import Button from "$lib/components/ui/Button.svelte";
  import FormMessage, { type FormMessage as FormMessageType } from "$lib/components/forms/FormMessage.svelte";
  import AuthShell from "$lib/components/AuthShell.svelte";

  let { data }: PageProps = $props();

  let name = $state("");
  let email = $state("");
  let password = $state("");
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
      const res = await client.api.auth.register.$post({ json: { name, email, password } });
      if (!res.ok) {
        const errorData = (await res.json()) as { message?: string; fieldErrors?: Record<string, string> };
        message = { type: "error", text: errorData.message ?? "Registration failed" };
        fieldErrors = errorData.fieldErrors ?? {};
        return;
      }
      message = { type: "success", text: "Account created." };
      await invalidateAll();
      redirectTimer = setTimeout(() => void goto(resolve("/login")), 1200);
    } catch {
      message = { type: "error", text: "Network error. Please try again." };
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Register · Issues</title>
</svelte:head>

<AuthShell title={data.open ? "Register" : "Registration closed"} lede={data.open ? "Create the single owner account." : "No more users are allowed currently."}>
  {#if !data.open}
    <a class="alt-cta" href={resolve("/login")}>Go to sign in</a>
  {:else}
    <form
      novalidate
      onsubmit={e => {
        e.preventDefault();
        void handleSubmit();
      }}
    >
      <div class="field">
        <label for="name">Name</label>
        <input type="text" id="name" class="form-input" aria-invalid={fieldErrors.name ? "true" : undefined} bind:value={name} placeholder="Your name" required maxlength="25" />
        {#if fieldErrors.name}<span class="field-error">{fieldErrors.name}</span>{/if}
      </div>

      <div class="field">
        <label for="email">Email</label>
        <input type="email" id="email" class="form-input" aria-invalid={fieldErrors.email ? "true" : undefined} bind:value={email} placeholder="you@example.com" required maxlength="120" />
        {#if fieldErrors.email}<span class="field-error">{fieldErrors.email}</span>{/if}
      </div>

      <div class="field">
        <label for="password">Password</label>
        <input
          type="password"
          id="password"
          class="form-input"
          aria-invalid={fieldErrors.password ? "true" : undefined}
          bind:value={password}
          placeholder="At least 8 characters"
          required
          minlength="8"
        />
        {#if fieldErrors.password}<span class="field-error">{fieldErrors.password}</span>{/if}
      </div>

      <FormMessage {message} />

      <Button type="submit" disabled={submitting} fullWidth>
        {submitting ? "Creating..." : "Create account"}
      </Button>
    </form>

    <p class="alt">
      Already set up? <a href={resolve("/login")}>Sign in</a>
    </p>
  {/if}
</AuthShell>

<style>
  .alt-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.65rem 1rem;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg);
    color: var(--accent-base);
    font-weight: 600;
    text-decoration: none;
    transition:
      background var(--motion-fast) var(--ease-out-quart),
      border-color var(--motion-fast) var(--ease-out-quart);

    &:hover {
      background: var(--accent-tint-900);
      border-color: var(--accent-tint-600);
    }
  }
</style>
