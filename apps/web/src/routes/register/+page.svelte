<script lang="ts">
  import "$lib/styles/authForm.css";
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
        setTimeout(() => goto(resolve("/login")), 1500);
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
  {#if registrationOpen === null}
    <p>Loading...</p>
  {:else if registrationOpen === false}
    <div class="closed-message">
      <p>Registration is currently closed.</p>
    </div>
  {:else}
    <form
      onsubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      class="auth-form"
    >
      <h1 class="auth-form-header">Register user</h1>
      <div class="input-row">
        <label for="name" class="input-label">Name</label>
        <input type="text" id="name" class="auth-form-input" bind:value={name} placeholder="Enter name..." required maxlength="25" />
      </div>
      <div class="input-row">
        <label for="email" class="input-label">Email</label>
        <input type="email" id="email" class="auth-form-input" bind:value={email} placeholder="Enter email..." required maxlength="120" />
      </div>
      <div class="input-row">
        <label for="password" class="input-label">Password</label>
        <input type="password" id="password" class="auth-form-input" minlength="8" bind:value={password} placeholder="Enter password..." required />
      </div>
      {#if formMessage}
        <div class="form-feedback" class:error={formMessage.error}>
          {formMessage.text}
        </div>
      {/if}
      <button type="submit" disabled={submitting} class="auth-form-button">
        {submitting ? "Registering..." : "Register"}
      </button>
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
