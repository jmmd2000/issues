<script lang="ts">
  import "$lib/styles/form.css";
  import { resolve } from "$app/paths";
  import { goto } from "$app/navigation";
  import { client } from "$lib/api/client";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

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
    >
      <h1 class="form-header">Register user</h1>
      <div class="input-row">
        <label for="name" class="form-label">Name</label>
        <input type="text" id="name" class="form-input" bind:value={name} placeholder="Enter name..." required maxlength="25" />
      </div>
      <div class="input-row">
        <label for="email" class="form-label">Email</label>
        <input type="email" id="email" class="form-input" bind:value={email} placeholder="Enter email..." required maxlength="120" />
      </div>
      <div class="input-row">
        <label for="password" class="form-label">Password</label>
        <input type="password" id="password" class="form-input" minlength="8" bind:value={password} placeholder="Enter password..." required />
      </div>
      {#if formMessage}
        <div class="form-feedback" class:error={formMessage.error}>
          {formMessage.text}
        </div>
      {/if}
      <button type="submit" disabled={submitting} class="form-button">
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
