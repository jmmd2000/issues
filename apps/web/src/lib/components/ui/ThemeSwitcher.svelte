<script lang="ts">
  import { onMount } from "svelte";
  import { Monitor, Moon, Sun } from "@lucide/svelte";
  import { applyTheme, readStoredTheme, storeTheme, type ThemeChoice } from "$lib/theme";
  import SegmentedControl, { type SegmentedOption } from "$lib/components/ui/SegmentedControl.svelte";

  let { size = "md" }: { size?: "sm" | "md" } = $props();

  const options: SegmentedOption<ThemeChoice>[] = [
    { value: "system", label: "System", icon: Monitor },
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ];

  let theme = $state<ThemeChoice>("system");

  onMount(() => {
    theme = readStoredTheme();
  });

  function choose(next: ThemeChoice) {
    storeTheme(next);
    applyTheme(next);
  }
</script>

<SegmentedControl bind:value={theme} {options} label="Theme" {size} onchange={choose} />
