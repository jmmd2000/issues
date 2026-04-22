<script lang="ts">
  import type { HTMLButtonAttributes, HTMLAnchorAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  type CommonProps = {
    variant?: "primary" | "danger";
    size?: "sm" | "md" | "lg";
    fullWidth?: boolean;
    children: Snippet;
  };

  type ButtonProps = CommonProps & HTMLButtonAttributes & { href?: undefined };
  type AnchorProps = CommonProps & HTMLAnchorAttributes & { href: string };
  type Props = ButtonProps | AnchorProps;

  let { variant = "primary", size = "md", fullWidth = false, children, class: className, ...rest }: Props = $props();

  const classes = $derived(["button", variant, size, { "full-width": fullWidth }, className]);
</script>

{#if "href" in rest && rest.href !== undefined}
  <a class={classes} {...rest as HTMLAnchorAttributes}>
    {@render children()}
  </a>
{:else}
  {@const buttonRest = rest as HTMLButtonAttributes}
  <button type={buttonRest.type ?? "button"} class={classes} {...buttonRest}>
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

  .sm {
    font-size: 0.75rem;
    padding: 0.45em 0.85em;
  }

  .md {
    font-size: 0.85rem;
    padding: 0.6em 1.05em;
  }

  .lg {
    font-size: 0.95rem;
    padding: 0.75em 1.25em;
  }

  .primary {
    background: linear-gradient(180deg, #4a6ee8, var(--accent-base));
    color: white;
    border: 1px solid var(--accent-shade-100);
    box-shadow:
      rgba(30, 34, 41, 0.2) 0px 1px 3px,
      rgba(255, 255, 255, 0.14) 0px 1px 0px inset;
  }

  .primary:hover:not(:disabled) {
    background: linear-gradient(180deg, var(--accent-base), var(--accent-shade-200));
  }

  .primary:active:not(:disabled) {
    transform: translateY(1px);
    box-shadow:
      rgba(30, 34, 41, 0.25) 0px 0px 1px,
      rgba(255, 255, 255, 0.08) 0px 1px 0px inset;
  }

  .danger {
    background: var(--colour-error);
    color: white;
    border: 1px solid var(--colour-error-border);
    box-shadow:
      rgba(30, 34, 41, 0.2) 0px 1px 3px,
      rgba(255, 255, 255, 0.14) 0px 1px 0px inset;
  }

  .danger:hover:not(:disabled) {
    background: #b82929;
  }

  .danger:active:not(:disabled) {
    transform: translateY(1px);
    box-shadow:
      rgba(30, 34, 41, 0.25) 0px 0px 1px,
      rgba(255, 255, 255, 0.08) 0px 1px 0px inset;
  }
</style>
