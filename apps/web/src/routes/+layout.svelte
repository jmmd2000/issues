<!-- Root level layout -->
<script lang="ts">
  import "$lib/../app.css";
  import { resolve } from "$app/paths";
  import type { Snippet } from "svelte";
  import type { LayoutProps } from "./$types";
  import favicon from "$lib/assets/favicon.svg";
  import UserMenu from "$lib/components/UserMenu.svelte";

  let { data, children }: LayoutProps & { children: Snippet } = $props();
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap" rel="stylesheet" />
  <link rel="icon" href={favicon} type="image/svg+xml" />
</svelte:head>

<nav>
  <span class="icon-title">
    <img src={favicon} alt="" width="24" height="24" />
    <a href={resolve("/")}>Issues</a>
  </span>

  <div class="user-menu-container"><UserMenu user={data.user} /></div>
</nav>

<main>
  {@render children()}
</main>

<style>
  nav {
    min-height: 55px;
    display: flex;
    align-items: center;
    padding: 0 2rem;
    border-bottom: var(--border);
    background-color: var(--colour-bg-lighter);

    a {
      font-weight: 700;
      font-size: 1rem;
      text-decoration: none;
      color: var(--colour-text);
    }
  }

  .user-menu-container {
    margin-left: auto;
  }

  main {
    max-width: 95em;
    margin: 2rem auto;
    padding: 0 2rem;
    font-size: clamp(1rem, 0.18vw + 0.85rem, 1.25rem);
  }

  .icon-title {
    display: flex;
    align-items: center;
    gap: 0.5em;
  }
</style>
