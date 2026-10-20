<script lang="ts">
  import { Check } from "@lucide/svelte";
  import { LABEL_PALETTE, parseHexColour } from "$lib/labels";
  import Popover from "$lib/components/ui/Popover.svelte";

  let {
    value = $bindable("#355dd4"),
    ariaLabel = "Choose colour",
    disabled = false,
    onchange,
  }: {
    value?: string;
    ariaLabel?: string;
    disabled?: boolean;
    /** Called after the person picks a palette colour or types a valid hex colour. */
    onchange?: (next: string) => void;
  } = $props();

  let open = $state(false);
  let hexDraft = $state("");
  let hexInvalid = $state(false);

  $effect(() => {
    if (open) {
      hexDraft = value;
      hexInvalid = false;
    }
  });

  function choose(next: string) {
    if (next === value) return;
    value = next;
    onchange?.(next);
  }

  function pick(colour: string) {
    choose(colour);
    open = false;
  }

  function applyHex() {
    const parsed = parseHexColour(hexDraft);
    hexInvalid = parsed === null;
    if (!parsed) return;
    hexDraft = parsed;
    choose(parsed);
  }
</script>

<Popover bind:open menuRole="dialog" menuLabel="Choose a colour" {disabled}>
  {#snippet trigger({ toggle, open: isOpen })}
    <button type="button" class="swatch-button" style:--swatch={value} aria-label={ariaLabel} aria-haspopup="dialog" aria-expanded={isOpen} {disabled} onclick={toggle}></button>
  {/snippet}

  {#snippet menu()}
    <div class="palette" role="group" aria-label="Colours">
      {#each LABEL_PALETTE as colour (colour)}
        <button type="button" class="palette-swatch" style:--swatch={colour} aria-label={colour} aria-pressed={colour === value} onclick={() => pick(colour)}>
          {#if colour === value}<Check size={12} strokeWidth={3.5} />{/if}
        </button>
      {/each}
    </div>
    <label class="hex">
      <span>Hex</span>
      <input
        class="form-input compact"
        bind:value={hexDraft}
        maxlength="7"
        spellcheck="false"
        autocomplete="off"
        aria-invalid={hexInvalid ? "true" : undefined}
        onchange={applyHex}
        onkeydown={event => {
          if (event.key === "Enter") {
            event.preventDefault();
            applyHex();
          }
        }}
      />
    </label>
  {/snippet}
</Popover>

<style>
  .swatch-button,
  .palette-swatch {
    display: grid;
    place-items: center;
    padding: 0;
    border: 1px solid color-mix(in oklab, var(--swatch) 55%, var(--colour-ink) 45%);
    border-radius: 999px;
    background: var(--swatch);
    color: white;
    cursor: pointer;
  }

  .swatch-button {
    width: 1.5rem;
    height: 1.5rem;
    transition: transform var(--motion-base) var(--ease-out-quart);

    &:hover:not(:disabled) {
      transform: scale(1.1);
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
  }

  .palette {
    display: grid;
    grid-template-columns: repeat(5, 1.75rem);
    gap: 0.5rem;
    padding: 0.5rem;
  }

  .palette-swatch {
    width: 1.75rem;
    height: 1.75rem;
  }

  .hex {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.5rem 0.5rem;
    color: var(--colour-text-secondary);
    font-size: 0.8125rem;

    & input {
      font-family: var(--font-mono);
    }
  }
</style>
