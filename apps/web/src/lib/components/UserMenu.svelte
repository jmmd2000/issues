<script lang="ts">
  import { resolve } from "$app/paths";
  import { invalidateAll } from "$app/navigation";
  import type { CurrentUser } from "@issues/api";
  import { client } from "$lib/api/client";

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
        {#if user.avatarURL}
          <img src={user.avatarURL} alt={user.name} />
        {:else}
          <span class="avatar-fallback">{user.name?.[0]?.toUpperCase() ?? "?"}</span>
        {/if}
        <span class="user-name">{user.name}</span>
      </div>
    </summary>
    <div class="dropdown-menu">
      <p>Settings</p>
      <button onclick={handleLogout}>Logout</button>
    </div>
  </details>
{:else}
  <a href={resolve("/login")} class="login-link">Login</a>
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

  .user-info img {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
  }

  .user-name {
    font-weight: 500;
  }

  .avatar-fallback {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background-color: var(--accent);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
  }

  .login-link {
    padding: 0.5rem 1rem;
    border: var(--border-accent);
    border-radius: var(--border-radius-outer);
    background-color: var(--accent);
    text-decoration: none;
    color: white;
    font-weight: 500;

    &:hover {
      background-color: var(--accent-hover);
    }
  }
</style>
