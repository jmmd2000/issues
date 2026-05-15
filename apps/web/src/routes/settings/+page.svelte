<script lang="ts">
  import "$lib/styles/form.css";
  import { resolve } from "$app/paths";
  import { MoveLeft } from "@lucide/svelte";
  import type { PageProps } from "./$types";
  import AvatarForm from "$lib/components/forms/AvatarForm.svelte";
  import PasswordForm from "$lib/components/forms/PasswordForm.svelte";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Settings</title>
</svelte:head>

<div class="settings-page">
  <div class="heading-row">
    <a href={resolve("/")} class="back-link"><span><MoveLeft size={16} strokeWidth={2} /> Back home</span></a>
    <div class="heading-content">
      <h1>Account Settings</h1>
      <p>Manage your account.</p>
    </div>
  </div>

  <section class="settings-card-container">
    <h2>Avatar</h2>
    <AvatarForm user={data.user} />
  </section>

  <section class="settings-card-container">
    <h2>Password</h2>
    <PasswordForm />
  </section>
</div>

<style>
  .settings-page {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .heading-row {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .back-link {
    text-decoration: none;
    color: var(--accent-base);
    font-weight: 500;
    font-size: 0.9em;
    transition: color 0.4s ease;

    & span {
      display: flex;
      align-items: center;
      gap: 0.5em;
    }

    &:hover {
      color: var(--accent-tint-300);
    }
  }

  .heading-content {
    margin-top: 2rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    & h1 {
      font-size: 1.5em;
      font-weight: 600;
    }

    & p {
      color: var(--colour-text-secondary);
      font-weight: 300;
    }
  }

  .settings-card-container {
    display: flex;
    flex-direction: column;
    gap: 1em;

    & h2 {
      font-size: 1em;
      font-weight: 500;
      letter-spacing: -0.02em;
    }
  }
</style>
