<script lang="ts">
  import { Eye, EyeOff } from "@lucide/svelte";
  import type { Visibility } from "@issues/api";
  import SegmentedControl, { type SegmentedOption } from "./SegmentedControl.svelte";

  interface VisibilityToggleProps {
    value: Visibility;
    disabled?: boolean;
    size?: "sm" | "md";
    /** Called whenever the user picks the other option. Bindable callers can use $bindable + onchange together. */
    onchange?: (next: Visibility, previous: Visibility) => void;
  }

  let { value = $bindable(), disabled = false, size = "md", onchange }: VisibilityToggleProps = $props();

  const options: SegmentedOption<Visibility>[] = [
    { value: "public", label: "Public", icon: Eye },
    { value: "private", label: "Private", icon: EyeOff },
  ];
</script>

<SegmentedControl bind:value {options} label="Visibility" {disabled} {size} {onchange} />
