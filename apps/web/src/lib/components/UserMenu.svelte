<script lang="ts">
  import { resolve } from "$app/paths";
  import { invalidateAll } from "$app/navigation";
  import type { CurrentUser } from "@issues/api";
  import { client } from "$lib/api/client";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import Button from "$lib/components/ui/Button.svelte";

  let { user }: { user: CurrentUser | null } = $props();

  let detailsEl: HTMLDetailsElement = $state(null!);

  async function handleLogout() {
    await client.api.auth.logout.$post();
    await invalidateAll();
  }

  $effect(() => {
    function handleClick(e: MouseEvent) {
      if (detailsEl.open && !detailsEl.contains(e.target as Node)) detailsEl.open = false;
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  });
</script>

{#if user}
  <details bind:this={detailsEl} class="dropdown">
    <summary>
      <div class="user-info">
        <UserAvatar name={user.name} avatarURL={user.avatarURL} />
        <span class="user-name">{user.name}</span>
      </div>
    </summary>
    <div class="dropdown-menu">
      <p>Settings</p>
      <button onclick={handleLogout}>Logout</button>
    </div>
  </details>
{:else}
  <Button href={resolve("/login")} size="sm">Login</Button>
{/if}

<style>
  .dropdown {
    position: relative;
  }

  summary {
    cursor: pointer;
    list-style: none;
  }

  .dropdown-menu {
    position: absolute;
    right: 0;
    top: 100%;
    margin-top: 0.5rem;
    background-color: var(--colour-bg-lighter);
    border: var(--border);
    border-radius: var(--border-radius-inner);
    box-shadow: var(--box-shadow);
    min-width: 150px;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem;

    p,
    button {
      margin: 0;
      padding: 0.5rem;
      text-align: left;
      background: none;
      border: none;
      width: 100%;
      cursor: pointer;
    }

    p:hover,
    button:hover {
      background-color: var(--colour-bg);
    }

    button {
      color: var(--colour-error);
    }
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .user-name {
    font-weight: 500;
  }
</style>
