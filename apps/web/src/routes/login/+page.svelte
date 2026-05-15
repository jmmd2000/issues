<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import { onDestroy } from "svelte";
  import { client } from "$lib/api/client";
  import Button from "$lib/components/ui/Button.svelte";
  import FormMessage, { type FormMessage as FormMessageType } from "$lib/components/forms/FormMessage.svelte";

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
      redirectTimer = setTimeout(() => goto(target), 1200);
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

<section class="auth">
  <aside class="brand">
    <div class="brand-body">
      <h2 class="brand-headline">My personal issue tracker.</h2>
      <p class="brand-sub">Just for me.</p>
    </div>
  </aside>

  <main class="form-panel">
    <div class="form-frame">
      <header class="frame-head">
        <h1>Sign in</h1>
        <p class="lede">Welcome back to your tickets.</p>
      </header>

      <form
        novalidate
        onsubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <div class="field">
          <label for="email">Email</label>
          <input type="email" id="email" bind:value={email} placeholder="you@example.com" required maxlength="120" />
          {#if fieldErrors.email}<span class="field-error">{fieldErrors.email}</span>{/if}
        </div>

        <div class="field">
          <label for="password">Password</label>
          <input type="password" id="password" bind:value={password} placeholder="••••••••" required minlength="8" />
          {#if fieldErrors.password}<span class="field-error">{fieldErrors.password}</span>{/if}
        </div>

        <FormMessage {message} />

        <Button type="submit" disabled={submitting} fullWidth>
          {submitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <p class="alt">
        New? <a href={resolve("/register")}>Create an account</a>
      </p>
    </div>
  </main>
</section>

<style>
  .auth {
    display: grid;
    grid-template-columns: minmax(0, 0.85fr) minmax(0, 1fr);
    min-height: calc(100vh - 55px);
    margin: -2rem -2rem 0;
  }

  .brand {
    position: relative;
    overflow: hidden;
    display: grid;
    grid-template-rows: 1fr auto;
    padding: 3rem 3rem 2.5rem;
    background:
      radial-gradient(circle at 28% 18%, rgb(from var(--colour-bg-lighter) r g b / 0.12), transparent 55%),
      radial-gradient(circle at 78% 82%, rgb(from var(--colour-text) r g b / 0.25), transparent 60%), var(--accent-base);
    color: var(--colour-bg-lighter);
  }

  .brand-body {
    align-self: center;
  }

  .brand-headline {
    font-size: clamp(2rem, 3.5vw, 3.25rem);
    font-weight: 700;
    line-height: 1.05;
    letter-spacing: -0.02em;
    max-width: 14ch;
  }

  .brand-sub {
    margin-top: 1rem;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    letter-spacing: 0.05em;
    color: rgb(from var(--colour-bg-lighter) r g b / 0.75);
  }

  .brand-foot {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgb(from var(--colour-bg-lighter) r g b / 0.5);
  }

  .form-panel {
    display: grid;
    place-items: center;
    padding: 3rem 2rem;
    background: var(--colour-bg-lighter);
  }

  .form-frame {
    width: 100%;
    max-width: 380px;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .frame-head h1 {
    font-size: 2rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--colour-text);
  }

  .lede {
    margin-top: 0.4rem;
    color: var(--colour-text-secondary);
    font-size: 0.95rem;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .field label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--colour-muted);
  }

  .field input {
    padding: 0.75rem 0.85rem;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg);
    color: var(--colour-text);
    font-size: 1rem;
    transition:
      border-color var(--motion-fast) var(--ease-out-quart),
      background var(--motion-fast) var(--ease-out-quart);
  }

  .field input:focus {
    outline: none;
    border-color: var(--accent-base);
    background: var(--colour-bg-lighter);
  }

  .field-error {
    font-size: 0.8rem;
    color: var(--colour-error);
  }

  .alt {
    font-size: 0.85rem;
    color: var(--colour-text-secondary);

    a {
      color: var(--accent-base);
      font-weight: 600;
      text-decoration: none;
      transition: color var(--motion-fast) var(--ease-out-quart);

      &:hover {
        color: var(--accent-tint-300);
        text-decoration: underline;
      }
    }
  }

  @media (max-width: 720px) {
    .auth {
      grid-template-columns: 1fr;
      min-height: auto;
    }

    .brand {
      padding: 2.5rem 1.5rem;
      gap: 2rem;
    }

    .brand-headline {
      font-size: 2rem;
    }

    .form-panel {
      padding: 2.5rem 1.5rem;
    }
  }
</style>
