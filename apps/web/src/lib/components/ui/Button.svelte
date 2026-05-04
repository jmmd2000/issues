<script lang="ts">
  import type { HTMLButtonAttributes, HTMLAnchorAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  type CommonProps = {
    variant?: "primary" | "secondary" | "danger";
    size?: "sm" | "md" | "lg";
    fullWidth?: boolean;
    children: Snippet;
  };

  type ButtonProps = CommonProps & HTMLButtonAttributes & { href?: undefined };
  type AnchorProps = CommonProps & HTMLAnchorAttributes & { href: string };
  type Props = ButtonProps | AnchorProps;

  let { variant = "primary", size = "md", fullWidth = false, children, class: className, ...rest }: Props = $props();

  const classes = $derived(["button", className]);
</script>

{#if "href" in rest && rest.href !== undefined}
  <a class={classes} data-variant={variant} data-size={size} data-full-width={fullWidth} {...rest as HTMLAnchorAttributes}>
    {@render children()}
  </a>
{:else}
  {@const buttonRest = rest as HTMLButtonAttributes}
  <button type={buttonRest.type ?? "button"} class={classes} data-variant={variant} data-size={size} data-full-width={fullWidth} {...buttonRest}>
    {@render children()}
  </button>
{/if}

<style>
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-weight: 500;
    cursor: pointer;
    border-radius: var(--border-radius-inner);
    letter-spacing: -0.02em;
    white-space: nowrap;
    user-select: none;
    text-decoration: none;
    font-family: inherit;
    transition:
      background 0.12s,
      box-shadow 0.12s,
      transform 0.06s;

    &:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
  }

  .button[data-full-width="true"] {
    width: 100%;
  }

  .button[data-size="sm"] {
    font-size: 0.75rem;
    padding: 0.45em 0.85em;
  }

  .button[data-size="md"] {
    font-size: 0.85rem;
    padding: 0.6em 1.05em;
  }

  .button[data-size="lg"] {
    font-size: 0.95rem;
    padding: 0.75em 1.25em;
  }

  .button[data-variant="primary"] {
    background: linear-gradient(180deg, #4a6ee8, var(--accent-base));
    color: white;
    border: 1px solid var(--accent-shade-100);
    box-shadow:
      rgba(30, 34, 41, 0.2) 0px 1px 3px,
      rgba(255, 255, 255, 0.14) 0px 1px 0px inset;

    &:hover:not(:disabled) {
      background: linear-gradient(180deg, var(--accent-base), var(--accent-shade-200));
    }

    &:active:not(:disabled) {
      transform: translateY(1px);
      box-shadow:
        rgba(30, 34, 41, 0.25) 0px 0px 1px,
        rgba(255, 255, 255, 0.08) 0px 1px 0px inset;
    }
  }

  .button[data-variant="secondary"] {
    background: var(--colour-bg-lighter);
    color: var(--colour-text);
    border: 1px solid var(--colour-border);
    box-shadow:
      0 1px 2px rgba(30, 34, 41, 0.07),
      inset 0 1px 0 rgba(255, 255, 255, 0.9);

    &:hover:not(:disabled) {
      background: var(--colour-bg-hover);
    }

    &:active:not(:disabled) {
      background: var(--colour-bg-hover);
      box-shadow: none;
      transform: translateY(1px);
    }
  }

  .button[data-variant="danger"] {
    background: var(--colour-error);
    color: white;
    border: 1px solid color-mix(in oklch, var(--colour-error) 82%, black 18%);
    box-shadow:
      rgba(30, 34, 41, 0.2) 0px 1px 3px,
      rgba(255, 255, 255, 0.14) 0px 1px 0px inset;

    &:hover:not(:disabled) {
      background: color-mix(in oklch, var(--colour-error) 84%, black 16%);
    }
  }

  .button[data-variant="danger"]:active:not(:disabled) {
    transform: translateY(1px);
    box-shadow:
      rgba(30, 34, 41, 0.25) 0px 0px 1px,
      rgba(255, 255, 255, 0.08) 0px 1px 0px inset;
  }
</style>
