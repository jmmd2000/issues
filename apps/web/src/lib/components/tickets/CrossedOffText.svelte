<script lang="ts">
  import type { Snippet } from "svelte";

  interface CrossedOffTextProps {
    crossed: boolean;
    children: Snippet;
  }

  let { crossed, children }: CrossedOffTextProps = $props();
</script>

<span class="crossed-off-text" class:crossed>{@render children()}</span>

<style>
  /* The line is a background on the inline text, so it follows wrapped lines
     and draws across each one in reading order. */
  .crossed-off-text {
    background-image: linear-gradient(var(--colour-text), var(--colour-text));
    background-repeat: no-repeat;
    background-position: 0 60%;
    background-size: 0% 1px;
    transition:
      background-size 360ms var(--ease-out-quart),
      color 360ms var(--ease-out-quart);

    &.crossed {
      background-size: 100% 1px;
      color: var(--colour-muted);
    }
  }
</style>
