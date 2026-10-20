<script lang="ts">
  import { onMount } from "svelte";
  import { resolve } from "$app/paths";
  import { invalidateAll } from "$app/navigation";
  import { ChevronDown, KeyRound, LogOut, Monitor, Moon, Settings, Sun } from "@lucide/svelte";
  import type { CurrentUser } from "@issues/api";
  import { client } from "$lib/api/client";
  import { shortHash, webBuild } from "$lib/buildInfo";
  import { applyTheme, readStoredTheme, storeTheme, type ThemeChoice } from "$lib/theme";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Popover from "$lib/components/ui/Popover.svelte";
  import SegmentedControl, { type SegmentedOption } from "$lib/components/ui/SegmentedControl.svelte";

  let { user }: { user: CurrentUser | null } = $props();

  const themeOptions: SegmentedOption<ThemeChoice>[] = [
    { value: "system", label: "System", icon: Monitor },
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ];

  const tokensHref = `${resolve("/settings")}#tokens`;

  let open = $state(false);
  let theme = $state<ThemeChoice>("system");

  onMount(() => {
    theme = readStoredTheme();
  });

  function chooseTheme(next: ThemeChoice) {
    storeTheme(next);
    applyTheme(next);
  }

  async function handleLogout() {
    open = false;
    await client.api.auth.logout.$post();
    await invalidateAll();
  }
</script>

{#if user}
  <Popover bind:open menuRole="menu" menuLabel="Account">
    {#snippet trigger({ toggle, open: isOpen })}
      <button type="button" class="account-trigger" onclick={toggle} aria-haspopup="menu" aria-expanded={isOpen}>
        <UserAvatar name={user.name} avatarURL={user.avatarURL} />
        <span class="user-name">{user.name}</span>
        <ChevronDown size={14} strokeWidth={2} class="chevron" />
      </button>
    {/snippet}

    {#snippet menu()}
      <div class="account-menu">
        <div class="identity">
          <UserAvatar name={user.name} avatarURL={user.avatarURL} />
          <div class="identity-text">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
        </div>

        <div class="menu-separator" role="separator"></div>

        <a class="menu-item" role="menuitem" href={resolve("/settings")} onclick={() => (open = false)}><Settings size={14} strokeWidth={2} /> Account settings</a>
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- tokensHref is built from resolve() plus a hash -->
        <a class="menu-item" role="menuitem" href={tokensHref} onclick={() => (open = false)}><KeyRound size={14} strokeWidth={2} /> API tokens</a>
        <button type="button" class="menu-item" role="menuitem" onclick={handleLogout}><LogOut size={14} strokeWidth={2} /> Sign out</button>

        <div class="menu-separator" role="separator"></div>

        <div class="theme-row">
          <span class="theme-label">Theme</span>
          <SegmentedControl bind:value={theme} options={themeOptions} label="Theme" size="sm" onchange={chooseTheme} />
        </div>

        <div class="menu-separator" role="separator"></div>

        <p class="build">Version {webBuild.siteVersion} · Build {shortHash(webBuild.gitSha)}</p>
      </div>
    {/snippet}
  </Popover>
{:else}
  <Button href={resolve("/login")} size="sm">Login</Button>
{/if}

<style>
  .account-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.2rem 0.4rem 0.2rem 0.2rem;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--colour-text);
    font: inherit;
    cursor: pointer;

    &:hover,
    &[aria-expanded="true"] {
      background: var(--colour-bg-hover);
    }

    & :global(.chevron) {
      color: var(--colour-muted);
    }
  }

  .user-name {
    font-weight: 500;
  }

  .account-menu {
    display: flex;
    flex-direction: column;
    gap: 0.2em;
    min-width: 15rem;
  }

  .identity {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem;
  }

  .identity-text {
    display: flex;
    flex-direction: column;
    min-width: 0;

    & strong {
      font-size: 0.9rem;
      font-weight: 600;
    }

    & span {
      overflow: hidden;
      color: var(--colour-text-secondary);
      font-size: 0.8rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .theme-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.25rem 0.5rem;
  }

  .theme-label {
    color: var(--colour-text-secondary);
    font-size: 0.8rem;
    font-weight: 600;
  }

  .build {
    margin: 0;
    padding: 0.25rem 0.5rem 0.15rem;
    color: var(--colour-muted);
    font-size: 0.75rem;
  }
</style>
