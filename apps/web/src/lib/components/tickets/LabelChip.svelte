<script lang="ts">
  let {
    name,
    colour,
  }: {
    name: string;
    colour: string;
  } = $props();
</script>

<span class="label-chip" style:--label-colour={colour}>{name}</span>

<style>
  .label-chip {
    --label-colour: var(--colour-muted);

    display: inline-flex;
    align-items: center;
    max-width: 100%;
    padding: 0.2rem 0.45rem;
    border: 1px solid color-mix(in oklch, var(--label-colour) 35%, white 65%);
    border-radius: var(--border-radius-inner);
    background: color-mix(in oklch, var(--label-colour) 15%, white 85%);
    color: color-mix(in oklch, var(--label-colour) 75%, black 25%);
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1.1;
    white-space: nowrap;
  }
</style>
