<script lang="ts">
  import type { Snippet } from "svelte";
  import { resolve } from "$app/paths";
  import favicon from "$lib/assets/favicon.svg";
  import ThemeToggle from "$lib/components/ui/ThemeToggle.svelte";

  let { title, lede, children }: { title: string; lede: string; children: Snippet } = $props();
</script>

<section class="auth">
  <aside class="brand">
    <a class="mark" href={resolve("/")}>
      <img src={favicon} alt="" width="28" height="28" />
      <span>Issues</span>
    </a>
    <div class="brand-body">
      <h2 class="brand-headline">My personal issue tracker.</h2>
      <p class="brand-sub">Just for me.</p>
    </div>
  </aside>

  <section class="form-panel">
    <div class="theme-corner">
      <ThemeToggle />
    </div>
    <div class="form-frame">
      <a class="mark narrow-only" href={resolve("/")}>
        <img src={favicon} alt="" width="28" height="28" />
        <span>Issues</span>
      </a>
      <header class="frame-head">
        <h1>{title}</h1>
        <p class="lede">{lede}</p>
      </header>
      {@render children()}
    </div>
  </section>
</section>

<style>
  .auth {
    display: grid;
    grid-template-columns: minmax(0, 0.85fr) minmax(0, 1fr);
    min-height: 100vh;
    margin: -2rem -2rem -2rem;
  }

  /* Ruled paper: a margin line and a rule every 2rem, both in the page's neutrals. */
  .brand {
    display: grid;
    grid-template-rows: auto 1fr;
    padding: 2.5rem 3rem;
    border-right: var(--border);
    background-color: var(--colour-bg);
    background-image:
      linear-gradient(to right, transparent 5rem, var(--colour-border-control) 5rem, var(--colour-border-control) calc(5rem + 1px), transparent calc(5rem + 1px)),
      repeating-linear-gradient(to bottom, transparent 0, transparent calc(2rem - 1px), var(--colour-border) calc(2rem - 1px), var(--colour-border) 2rem);
    background-position:
      0 0,
      0 0.5rem;
    color: var(--colour-text);
  }

  .mark {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: inherit;
    font-size: 1rem;
    font-weight: 700;
    text-decoration: none;
  }

  .narrow-only {
    display: none;
  }

  .brand-body {
    align-self: center;
    padding-left: 3rem;
  }

  .brand-headline {
    max-width: 12ch;
    font-size: clamp(2rem, 3.5vw, 3.25rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.2;
  }

  .brand-sub {
    margin-top: 1rem;
    color: var(--colour-muted);
    font-family: var(--font-mono);
    font-size: 0.85rem;
    letter-spacing: 0.05em;
  }

  .form-panel {
    position: relative;
    display: grid;
    place-items: center;
    padding: 3rem 2rem;
    background: var(--colour-bg-lighter);
  }

  .theme-corner {
    position: absolute;
    top: 1rem;
    right: 1.25rem;
  }

  .form-frame {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    width: 100%;
    max-width: 380px;
  }

  .form-frame :global(form) {
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
  }

  .form-frame :global(.field) {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .form-frame :global(.field label) {
    color: var(--colour-text-secondary);
    font-size: 0.875em;
    font-weight: 500;
    letter-spacing: -0.02em;
  }

  .form-frame :global(.field-error) {
    color: var(--colour-error);
    font-size: 0.8rem;
  }

  .form-frame :global(.alt) {
    color: var(--colour-text-secondary);
    font-size: 0.85rem;
  }

  .form-frame :global(.alt a) {
    color: var(--accent-base);
    font-weight: 600;
    text-decoration: none;
  }

  .form-frame :global(.alt a:hover) {
    text-decoration: underline;
  }

  .frame-head h1 {
    color: var(--colour-text);
    font-size: 2rem;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .lede {
    margin-top: 0.4rem;
    color: var(--colour-text-secondary);
    font-size: 0.95rem;
  }

  @media (max-width: 48rem) {
    .auth {
      grid-template-columns: minmax(0, 1fr);
    }

    .brand {
      display: none;
    }

    .narrow-only {
      display: flex;
    }

    .form-panel {
      padding: 2.5rem 1.5rem;
    }
  }
</style>
