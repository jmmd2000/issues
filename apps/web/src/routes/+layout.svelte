<script lang="ts">
  import { resolve } from "$app/paths";
  import type { Snippet } from "svelte";
  import "$lib/../app.css";

  let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" rel="stylesheet" />
</svelte:head>

<nav>
  <a href={resolve("/")}>Issues</a>
</nav>

<main>
  {@render children()}
</main>

<style>
  nav {
    padding: 1rem 2rem;
    border-bottom: var(--border);
    background: white;
    background-color: var(--colour-bg-lighter);
  }

  nav a {
    font-weight: 700;
    font-size: 1.25rem;
    text-decoration: none;
    color: var(--colour-text);
  }

  main {
    max-width: 1200px;
    margin: 2rem auto;
    padding: 0 2rem;
  }
</style>
