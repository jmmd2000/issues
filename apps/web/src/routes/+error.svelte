<!-- Root level error page -->
<script lang="ts">
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import Button from "$lib/components/ui/Button.svelte";

  interface ErrorCopy {
    heading: string;
    cause: string;
  }

  const currentPath = $derived(`${page.url.pathname}${page.url.search}`);
  const loginHref = $derived(`${resolve("/login")}?next=${encodeURIComponent(currentPath)}`);

  function copyFor(status: number, message: string | undefined): ErrorCopy {
    if (status === 401) return { heading: "Your session has ended.", cause: "Sign in again and this page reopens." };
    if (status === 403) return { heading: "You don't have access to this.", cause: message ?? "Your account can't open this page." };
    if (status === 404) return { heading: "This page doesn't exist.", cause: `Nothing is at ${page.url.pathname}.` };
    return { heading: "Something went wrong.", cause: message ?? "The page failed to load." };
  }

  const copy = $derived(copyFor(page.status, page.error?.message));
</script>

<svelte:head>
  <title>{page.status} · Issues</title>
</svelte:head>

<div class="error">
  <p class="status">{page.status}</p>
  <h1>{copy.heading}</h1>
  <p class="cause">{copy.cause}</p>

  <div class="actions">
    {#if page.status === 401}
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- loginHref is built from resolve() plus a query string -->
      <Button variant="primary" size="md" href={loginHref}>Sign in again</Button>
    {:else if page.status >= 500}
      <Button variant="primary" size="md" onclick={() => window.location.reload()}>Try again</Button>
    {/if}
    <a class="home" href={resolve("/")}>Back to projects</a>
  </div>
</div>

<style>
  .error {
    max-width: 32rem;
    margin: 4rem auto;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .status {
    font-family: var(--font-mono);
    font-size: 2rem;
    font-weight: 500;
    line-height: 1;
    color: var(--colour-muted);
    padding-bottom: 0.5rem;
    border-bottom: var(--border);
  }

  h1 {
    margin-top: 0.5rem;
    font-size: 1.3em;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .cause {
    color: var(--colour-text-secondary);
    max-width: 45ch;
    overflow-wrap: anywhere;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 0.75rem;
  }

  .home {
    font-size: 0.85rem;
    color: var(--colour-text-secondary);
  }
</style>
