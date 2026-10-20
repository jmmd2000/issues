<script lang="ts">
  import { onMount } from "svelte";
  import { Monitor, Moon, Sun } from "@lucide/svelte";
  import { applyTheme, nextThemeChoice, readStoredTheme, storeTheme, type ThemeChoice } from "$lib/theme";

  const LABELS: Record<ThemeChoice, string> = {
    system: "System theme",
    light: "Light theme",
    dark: "Dark theme",
  };

  let choice = $state<ThemeChoice>("system");

  onMount(() => {
    choice = readStoredTheme();
  });

  function handleClick() {
    choice = nextThemeChoice(choice);
    storeTheme(choice);
    applyTheme(choice);
  }
</script>

<button type="button" class="theme-toggle" onclick={handleClick} aria-label="{LABELS[choice]}. Press to change." title={LABELS[choice]}>
  {#if choice === "light"}
    <Sun size={16} strokeWidth={2} />
  {:else if choice === "dark"}
    <Moon size={16} strokeWidth={2} />
  {:else}
    <Monitor size={16} strokeWidth={2} />
  {/if}
</button>

<style>
  .theme-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: none;
    border-radius: var(--border-radius-inner);
    background: transparent;
    color: var(--colour-text-secondary);
    cursor: pointer;

    &:hover {
      background: var(--colour-bg-hover);
      color: var(--colour-text);
    }
  }
</style>
