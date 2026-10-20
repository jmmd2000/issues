<script lang="ts">
  import "$lib/styles/form.css";
  import type { PageProps } from "./$types";
  import type { ApiToken } from "@issues/api";
  import { client } from "$lib/api/client";
  import ApiTokensForm from "$lib/components/forms/ApiTokensForm.svelte";
  import AvatarForm from "$lib/components/forms/AvatarForm.svelte";
  import PasswordForm from "$lib/components/forms/PasswordForm.svelte";
  import ServiceUsersForm from "$lib/components/forms/ServiceUsersForm.svelte";
  import BuildInfo from "$lib/components/settings/BuildInfo.svelte";
  import SettingsNav from "$lib/components/settings/SettingsNav.svelte";
  import SettingsRow from "$lib/components/settings/SettingsRow.svelte";
  import SettingsSection from "$lib/components/settings/SettingsSection.svelte";

  let { data }: PageProps = $props();

  const sections = $derived([
    { id: "profile", label: "Profile" },
    { id: "security", label: "Security" },
    { id: "tokens", label: "API tokens" },
    ...(data.canManageServiceUsers ? [{ id: "service-users", label: "Service users" }] : []),
    { id: "about", label: "About" },
  ]);

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
  <title>Account settings · Issues</title>
</svelte:head>

<div class="settings-shell">
  <SettingsNav {sections} />

  <div class="settings-body">
    <h1>Account settings</h1>

    <SettingsSection id="profile" title="Profile">
      <SettingsRow title="Avatar" help="Shown next to your name on tickets and comments." stacked>
        <AvatarForm user={data.user} />
      </SettingsRow>
      <SettingsRow title="Name" help="Shown on tickets and comments.">
        <span>{data.user.name}</span>
      </SettingsRow>
      <SettingsRow title="Email" help="You sign in with this.">
        <span>{data.user.email}</span>
      </SettingsRow>
    </SettingsSection>

    <SettingsSection id="security" title="Security">
      <SettingsRow title="Change password" stacked>
        <PasswordForm />
      </SettingsRow>
    </SettingsSection>

    <SettingsSection id="tokens" title="API tokens" lede="Long-lived bearer tokens for programmatic access, such as the MCP server.">
      <SettingsRow stacked>
        <ApiTokensForm tokens={data.apiTokens} onCreate={createOwnToken} onRevoke={revokeOwnToken} />
      </SettingsRow>
    </SettingsSection>

    {#if data.canManageServiceUsers}
      <SettingsSection id="service-users" title="Service users" lede="Bot accounts that show up as the reporter on tickets and comments. Each service user has its own tokens.">
        <SettingsRow stacked>
          <ServiceUsersForm serviceUsers={data.serviceUsers} />
        </SettingsRow>
      </SettingsSection>
    {/if}

    <SettingsSection id="about" title="About" lede="The version of the site and the commits the web app and the API were built from.">
      <SettingsRow stacked>
        <BuildInfo apiBuild={data.apiBuild} />
      </SettingsRow>
    </SettingsSection>
  </div>
</div>

<style>
  :global(html) {
    scroll-behavior: smooth;
  }

  .settings-shell {
    display: grid;
    grid-template-columns: 12rem minmax(0, 1fr);
    gap: 3rem;
    max-width: 62rem;
    margin: 0 auto;
    padding: 2rem 1.5rem 3rem;
  }

  .settings-body {
    display: grid;
    gap: 2.5rem;
    min-width: 0;
    max-width: 44rem;
    align-content: start;
  }

  h1 {
    font-size: 1.3em;
    font-weight: 600;
    letter-spacing: -0.01em;
    line-height: 1.2;
  }

  @media (max-width: 46rem) {
    .settings-shell {
      grid-template-columns: minmax(0, 1fr);
      gap: 1.5rem;
    }
  }
</style>
