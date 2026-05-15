<script lang="ts">
  import "$lib/styles/form.css";
  import { resolve } from "$app/paths";
  import { MoveLeft } from "@lucide/svelte";
  import type { PageProps } from "./$types";
  import type { ApiToken } from "@issues/api";
  import { client } from "$lib/api/client";
  import ApiTokensForm from "$lib/components/forms/ApiTokensForm.svelte";
  import AvatarForm from "$lib/components/forms/AvatarForm.svelte";
  import PasswordForm from "$lib/components/forms/PasswordForm.svelte";
  import ServiceUsersForm from "$lib/components/forms/ServiceUsersForm.svelte";

  let { data }: PageProps = $props();

  async function createOwnToken(name: string, expiresInDays: number) {
    const res = await client.api.auth.tokens.$post({ json: { name, expiresInDays } });
    if (!res.ok) {
      const body = (await res.json()) as { message?: string; fieldErrors?: Record<string, string> };
      return { ok: false as const, message: body.message, fieldErrors: body.fieldErrors };
    }
    const body = (await res.json()) as { token: string; apiToken: ApiToken };
    return { ok: true as const, token: body.token, apiToken: body.apiToken };
  }

  async function revokeOwnToken(id: string) {
    const res = await client.api.auth.tokens[":id"].$delete({ param: { id } });
    if (!res.ok) {
      const body = (await res.json()) as { message?: string };
      return { ok: false as const, message: body.message };
    }
    return { ok: true as const };
  }
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

  <section class="settings-card-container">
    <h2>API tokens</h2>
    <p class="section-description">Long-lived bearer tokens for programmatic access.</p>
    <ApiTokensForm tokens={data.apiTokens} onCreate={createOwnToken} onRevoke={revokeOwnToken} />
  </section>

  {#if data.canManageServiceUsers}
    <section class="settings-card-container">
      <h2>Service users</h2>
      <p class="section-description">Bot accounts that show up as the reporter on tickets and comments. Each service user has its own tokens.</p>
      <ServiceUsersForm serviceUsers={data.serviceUsers} />
    </section>
  {/if}
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

  .section-description {
    margin: 0;
    color: var(--colour-text-secondary);
    font-size: 0.9em;
    line-height: 1.5;

    & a {
      color: var(--accent-base);
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }

    & code {
      background-color: var(--colour-bg);
      padding: 0.1em 0.3em;
      border-radius: var(--border-radius-inner);
      font-size: 0.85em;
    }
  }
</style>
