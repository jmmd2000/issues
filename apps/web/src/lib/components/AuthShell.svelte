<script lang="ts">
  import type { Snippet } from "svelte";
  import { resolve } from "$app/paths";
  import favicon from "$lib/assets/favicon.svg";
  import ThemeToggle from "$lib/components/ui/ThemeToggle.svelte";

  let { title, lede, children }: { title: string; lede: string; children: Snippet } = $props();
</script>

<section class="auth">
  <header class="top">
    <a class="mark" href={resolve("/")}>
      <img src={favicon} alt="" width="24" height="24" />
      <span>Issues</span>
    </a>
    <ThemeToggle />
  </header>

  <div class="sheet">
    <header class="sheet-head">
      <h1>{title}<span class="stop" aria-hidden="true">.</span></h1>
      <p class="lede">{lede}</p>
    </header>
    {@render children()}
  </div>
</section>

<style>
  /* Ruled paper: a rule every 2rem and one indigo margin line. */
  .auth {
    --rule: color-mix(in oklab, var(--colour-text) 10%, var(--colour-bg-lighter) 90%);

    position: relative;
    display: grid;
    place-items: center;
    min-height: 100vh;
    margin: -2rem;
    padding: 5rem 1rem 2rem;
    background-color: var(--colour-bg-lighter);
    background-image: repeating-linear-gradient(to bottom, transparent 0, transparent calc(2rem - 1px), var(--rule) calc(2rem - 1px), var(--rule) 2rem);
    background-position: 0 0.5rem;

    &::before {
      position: absolute;
      inset-block: 0;
      inset-inline-start: 8rem;
      width: 1px;
      background: color-mix(in oklab, var(--accent-base) 70%, var(--colour-bg-lighter) 30%);
      content: "";
    }
  }

  .top {
    position: absolute;
    inset-block-start: 0;
    inset-inline: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem 2rem;
  }

  .mark {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: inherit;
    font-size: 1rem;
    font-weight: 700;
    text-decoration: none;

    &:hover span {
      text-decoration: underline;
      text-underline-offset: 3px;
    }
  }

  .sheet {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
    width: min(25rem, 100%);
    padding: 2.25rem;
    border: 1px solid color-mix(in oklab, var(--colour-text) 20%, var(--colour-bg-lighter) 80%);
    border-radius: var(--border-radius-outer);
    background: var(--colour-paper);
    box-shadow:
      var(--box-shadow),
      0 12px 32px -12px rgb(from var(--colour-shadow) r g b / 0.15);
  }

  .sheet-head h1 {
    color: var(--colour-text);
    font-size: 1.9rem;
    font-weight: 600;
    letter-spacing: -0.03em;
    line-height: 1.15;
  }

  .stop {
    color: var(--accent-base);
  }

  .lede {
    margin-top: 0.35rem;
    color: var(--colour-text-secondary);
    font-size: 0.95rem;
  }

  .sheet :global(form) {
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
  }

  .sheet :global(.field) {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .sheet :global(.field label) {
    color: var(--colour-text-secondary);
    font-size: 0.875em;
    font-weight: 500;
    letter-spacing: -0.02em;
  }

  .sheet :global(.field-error) {
    color: var(--colour-error);
    font-size: 0.8rem;
  }

  .sheet :global(.alt) {
    color: var(--colour-text-secondary);
    font-size: 0.85rem;
  }

  .sheet :global(.alt a) {
    color: var(--accent-base);
    font-weight: 600;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  @media (max-width: 48rem) {
    .auth::before {
      display: none;
    }

    .sheet {
      padding: 1.75rem;
    }
  }
</style>
