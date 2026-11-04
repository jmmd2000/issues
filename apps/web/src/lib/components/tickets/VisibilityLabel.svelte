<script lang="ts">
  import { Globe2, Lock } from "@lucide/svelte";
  import type { Visibility } from "@issues/api";

  let { visibility }: { visibility: Visibility } = $props();

  const Icon = $derived(visibility === "public" ? Globe2 : Lock);
</script>

<span class="visibility-label">
  <Icon size={14} aria-hidden="true" />
  {visibility === "public" ? "Public" : "Private"}
</span>

<style>
  .visibility-label {
    display: inline-flex;
    align-items: center;
    gap: 0.35em;
  }
</style>
