<script lang="ts">
  import "$lib/styles/authForm.css";
  import { goto } from "$app/navigation";
  import { login } from "$lib/stores/user.svelte";
  import { resolve } from "$app/paths";

  let email: string = $state("");
  let password: string = $state("");
  let submitting = $state(false);
  let formMessage: { text: string; error: boolean } | null = $state(null);

  async function handleSubmit() {
    submitting = true;
    formMessage = null;
    try {
      await login(email, password);
      formMessage = { text: "Login successful!", error: false };
      setTimeout(() => goto(resolve("/")), 1500);
    } catch (err) {
      formMessage = { text: err instanceof Error ? err.message : "Login failed", error: true };
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
    class="auth-form"
  >
    <h1 class="auth-form-header">Login</h1>
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
      {submitting ? "Logging in..." : "Login"}
    </button>
  </form>
</div>
