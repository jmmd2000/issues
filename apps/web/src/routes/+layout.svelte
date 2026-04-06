<script lang="ts">
  import { resolve } from "$app/paths";
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();
</script>

<nav>
  <a href={resolve("/")}>Issues</a>
</nav>

<main>
  {@render children()}
</main>

<style>
  :global(body) {
    margin: 0;
    font-family: "Trebuchet MS", "Lucida Sans Unicode", "Lucida Grande", "Lucida Sans", Arial, sans-serif;
    color: #1a1a1a;
    background: #fafafa;
  }

  nav {
    padding: 1rem 2rem;
    border-bottom: 1px solid #e5e5e5;
    background: white;
  }

  nav a {
    font-weight: 700;
    font-size: 1.25rem;
    text-decoration: none;
    color: #1a1a1a;
  }

  main {
    max-width: 1200px;
    margin: 2rem auto;
    padding: 0 2rem;
  }
</style>
