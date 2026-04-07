<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { client } from "$lib/api/client";
  import { onMount } from "svelte";

  let registrationOpen: boolean | null = $state(null);

  async function checkRegistration() {
    const res = await client.api.auth["registration-status"].$get();
    const data = await res.json();
    registrationOpen = data.open;
  }

  onMount(() => {
    checkRegistration();
  });

  let name: string = $state("");
  let email: string = $state("");
  let password: string = $state("");
  let submitting = $state(false);
  let formMessage: { text: string; error: boolean } | null = $state(null);

  async function handleSubmit() {
    submitting = true;
    formMessage = null;
    try {
      const res = await client.api.auth.register.$post({
        json: { name, email, password },
      });
      if (res.ok) {
        formMessage = { text: "Registration successful!", error: false };
        setTimeout(() => goto(resolve("/")), 1500);
      } else {
        const errorData = (await res.json()) as { message?: string };
        formMessage = { text: errorData.message || "Registration failed", error: true };
      }
    } catch {
      formMessage = { text: "An error occurred during registration", error: true };
    } finally {
      submitting = false;
    }
  }
</script>

<div class="form-container">
  {#if registrationOpen === false}
    <div class="closed-message">
      <p>Registration is currently closed.</p>
    </div>
  {:else if registrationOpen === null}
    <p>Loading...</p>
  {:else}
    <form
      onsubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <h1>Register user</h1>
      <div class="input-row">
        <label for="name">Name</label>
        <input type="text" id="name" bind:value={name} placeholder="Enter name..." required maxlength="25" />
      </div>
      <div class="input-row">
        <label for="email">Email</label>
        <input type="email" id="email" bind:value={email} placeholder="Enter email..." required maxlength="120" />
      </div>
      <div class="input-row">
        <label for="password">Password</label>
        <input type="password" id="password" minlength="8" bind:value={password} placeholder="Enter password..." required />
      </div>
      {#if formMessage}
        <div class="form-feedback" class:error={formMessage.error}>
          {formMessage.text}
        </div>
      {/if}
      <button type="submit" disabled={submitting}>
        {submitting ? "Registering..." : "Register"}
      </button>
    </form>
  {/if}
</div>

<style>
  .form-container {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 15vh;
    min-height: calc(100vh - 8rem);
  }

  form {
    width: 550px;
    margin: 0 auto;
    padding: 2em;
    border: var(--border);
    border-radius: var(--border-radius-outer);
    background-color: var(--colour-bg-lighter);
    display: flex;
    flex-direction: column;
    gap: 1.4em;
    box-shadow: var(--box-shadow);
  }

  h1 {
    font-size: 1.3em;
    color: var(--colour-text);
    margin-bottom: 0.3em;
    font-weight: 600;
    padding-bottom: 0.5em;
    border-bottom: var(--border);
  }

  label {
    display: block;
    margin-bottom: 0.5em;
    font-weight: 500;
    text-transform: uppercase;
    font-size: 0.875em;
    letter-spacing: 0.05rem;
    color: var(--colour-muted);
  }

  input {
    width: 100%;
    padding: 0.4em 0.6em;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background-color: var(--colour-bg);
    font-size: 1em;

    &::placeholder {
      color: var(--colour-muted);
    }
  }

  button {
    width: 100%;
    padding: 0.75em;
    background-color: var(--accent);
    color: white;
    border: none;
    border-radius: var(--border-radius-inner);
    cursor: pointer;
    font-size: 1em;

    &[disabled] {
      background-color: var(--colour-muted);
      cursor: not-allowed;
    }

    &:not([disabled]):hover {
      background-color: var(--accent-hover);
    }
  }

  .form-feedback {
    padding: 0.75em 1em;
    border-radius: var(--border-radius-inner);
    font-size: 0.875em;
    background-color: var(--colour-success-bg);
    color: var(--colour-success);
    border: 1px solid var(--colour-success-border);

    &.error {
      background-color: var(--colour-error-bg);
      color: var(--colour-error);
      border: 1px solid var(--colour-error-border);
    }
  }

  .closed-message {
    padding: 2em;
    border: var(--border);
    border-radius: var(--border-radius-outer);
    background-color: var(--colour-bg-lighter);
    box-shadow: var(--box-shadow);
  }

  @media (min-width: 1921px) {
    form {
      font-size: 1.25rem;
      width: clamp(550px, 40vw, 800px);
    }
  }
</style>
