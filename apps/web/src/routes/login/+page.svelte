<script lang="ts">
  import "$lib/styles/form.css";
  import { goto, invalidateAll } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { client } from "$lib/api/client";

  let email: string = $state("");
  let password: string = $state("");
  let submitting = $state(false);
  let formMessage: { text: string; error: boolean } | null = $state(null);

  async function handleSubmit() {
    submitting = true;
    formMessage = null;
    try {
      const res = await client.api.auth.login.$post({
        json: { email, password },
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message || "Login failed");
      }
      formMessage = { text: "Login successful!", error: false };
      await invalidateAll();
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
    class="form-card"
  >
    <h1 class="form-header">Login</h1>
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
      {submitting ? "Logging in..." : "Login"}
    </button>
  </form>
</div>
