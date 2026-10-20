<script lang="ts">
  import { Moon, Sun } from "@lucide/svelte";
  import { applyTheme, isShowingDark, storeTheme } from "$lib/theme";

  function toggle() {
    const next = isShowingDark() ? "light" : "dark";
    storeTheme(next);
    applyTheme(next);
  }
</script>

<button type="button" class="theme-toggle" onclick={toggle} aria-label="Switch between light and dark theme" title="Switch between light and dark theme">
  <span class="icon-moon"><Moon size={16} strokeWidth={2} /></span>
  <span class="icon-sun"><Sun size={16} strokeWidth={2} /></span>
</button>

<style>
  .theme-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border: 0;
    border-radius: var(--border-radius-inner);
    background: transparent;
    color: var(--colour-text-secondary);
    cursor: pointer;

    &:hover {
      background: var(--colour-bg-hover);
      color: var(--colour-text);
    }
  }

  .icon-moon,
  .icon-sun {
    display: inline-flex;
  }

  .icon-sun {
    display: none;
  }

  /* The icon shows the theme the button switches to. Both rules read the page theme in CSS, so the first paint is right before any script runs. */
  :global(:root[data-theme="dark"]) .icon-moon {
    display: none;
  }

  :global(:root[data-theme="dark"]) .icon-sun {
    display: inline-flex;
  }

  @media (prefers-color-scheme: dark) {
    :global(:root:not([data-theme="light"])) .icon-moon {
      display: none;
    }

    :global(:root:not([data-theme="light"])) .icon-sun {
      display: inline-flex;
    }
  }
</style>
