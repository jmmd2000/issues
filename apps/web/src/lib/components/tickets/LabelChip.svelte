<script lang="ts">
  let {
    name,
    colour,
  }: {
    name: string;
    colour: string;
  } = $props();
</script>

<span class="label-chip tinted" style:--tint={colour}>{name}</span>

<style>
  .label-chip {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    padding: 0.2rem 0.45rem;
    border: 1px solid var(--tint-border);
    border-radius: var(--border-radius-inner);
    background: var(--tint-background);
    color: var(--tint-text);
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1.1;
    white-space: nowrap;
  }
</style>
