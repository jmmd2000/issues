<script lang="ts">
  import "$lib/../app.css";
  import { onMount } from "svelte";
  import { resolve } from "$app/paths";
  import type { Snippet } from "svelte";
  import { fetchUser } from "$lib/stores/user.svelte";
  import UserMenu from "$lib/components/UserMenu.svelte";

  onMount(() => {
    fetchUser();
  });

  let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" rel="stylesheet" />
</svelte:head>

<nav>
  <a href={resolve("/")}>Issues</a>
  <div class="user-menu-container"><UserMenu /></div>
</nav>

<main>
  {@render children()}
</main>

<style>
  nav {
    min-height: 65px;
    display: flex;
    align-items: center;
    padding: 1rem 2rem;
    border-bottom: var(--border);
    background-color: var(--colour-bg-lighter);

    a {
      font-weight: 700;
      font-size: 1.25rem;
      text-decoration: none;
      color: var(--colour-text);
    }
  }

  .user-menu-container {
    margin-left: auto;
  }

  main {
    max-width: 1200px;
    margin: 2rem auto;
    padding: 0 2rem;
  }
</style>
