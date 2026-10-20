<script lang="ts">
  import { Globe2, Lock } from "@lucide/svelte";
  import type { Visibility } from "@issues/api";

  let { value = $bindable("public"), name = "visibility" }: { value?: Visibility; name?: string } = $props();
</script>

<fieldset class="cards">
  <legend class="form-label">Visibility</legend>
  <div class="card-row">
    <label class="card" data-checked={value === "public"}>
      <input class="visually-hidden" type="radio" {name} value="public" bind:group={value} />
      <Globe2 size={16} strokeWidth={2} />
      <strong>Public</strong>
      <span>Anyone can read the project and its public tickets.</span>
    </label>
    <label class="card" data-checked={value === "private"}>
      <input class="visually-hidden" type="radio" {name} value="private" bind:group={value} />
      <Lock size={16} strokeWidth={2} />
      <strong>Private</strong>
      <span>Only members can open the project.</span>
    </label>
  </div>
</fieldset>

<style>
  .cards {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  .card-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }

  .card {
    display: grid;
    align-content: start;
    gap: 0.25rem;
    padding: 0.75rem;
    border: 1px solid var(--colour-border-control);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg-lighter);
    cursor: pointer;
    transition:
      border-color var(--motion-fast) var(--ease-out-quart),
      box-shadow var(--motion-fast) var(--ease-out-quart),
      background var(--motion-fast) var(--ease-out-quart);

    &:hover {
      border-color: var(--colour-border-control-hover);
    }

    &[data-checked="true"] {
      border-color: var(--colour-focus);
      background: var(--accent-tint-900);
      box-shadow: var(--shadow-focus-halo);
    }

    &:has(:focus-visible) {
      outline: 2px solid var(--colour-focus);
      outline-offset: 2px;
    }

    & span {
      color: var(--colour-text-secondary);
      font-size: 0.8125rem;
    }
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }

  @media (max-width: 32rem) {
    .card-row {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
