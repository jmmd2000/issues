<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { onDestroy } from "svelte";
  import { client } from "$lib/api/client";
  import type { PageProps } from "./$types";
  import Button from "$lib/components/ui/Button.svelte";
  import FormMessage, { type FormMessage as FormMessageType } from "$lib/components/forms/FormMessage.svelte";

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
      redirectTimer = setTimeout(() => goto(resolve("/login")), 1200);
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

<section class="auth">
  <aside class="brand">
    <div class="brand-body">
      <h2 class="brand-headline">My personal issue tracker.</h2>
      <p class="brand-sub">Just for me.</p>
    </div>
  </aside>

  <main class="form-panel">
    {#if !data.open}
      <div class="form-frame closed">
        <header class="frame-head">
          <h1>Registration closed</h1>
          <p class="lede">No more users are allowed currently.</p>
        </header>
        <a class="alt-cta" href={resolve("/login")}>Go to sign in</a>
      </div>
    {:else}
      <div class="form-frame">
        <header class="frame-head">
          <h1>Register</h1>
          <p class="lede">Create the single owner account.</p>
        </header>

        <form
          novalidate
          onsubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <div class="field">
            <label for="name">Name</label>
            <input type="text" id="name" bind:value={name} placeholder="Your name" required maxlength="25" />
            {#if fieldErrors.name}<span class="field-error">{fieldErrors.name}</span>{/if}
          </div>

          <div class="field">
            <label for="email">Email</label>
            <input type="email" id="email" bind:value={email} placeholder="you@example.com" required maxlength="120" />
            {#if fieldErrors.email}<span class="field-error">{fieldErrors.email}</span>{/if}
          </div>

          <div class="field">
            <label for="password">Password</label>
            <input type="password" id="password" bind:value={password} placeholder="At least 8 characters" required minlength="8" />
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
      </div>
    {/if}
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
