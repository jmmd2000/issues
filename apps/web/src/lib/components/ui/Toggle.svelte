<script lang="ts">
  let {
    checked = $bindable(false),
    onChange,
    label,
    size = "md",
    disabled = false,
    ariaLabel,
  }: {
    checked?: boolean;
    onChange?: (next: boolean) => void;
    label?: string;
    size?: "sm" | "md";
    disabled?: boolean;
    ariaLabel?: string;
  } = $props();

  const dimensions = {
    md: { width: 36, height: 20, dot: 14 },
    sm: { width: 28, height: 16, dot: 11 },
  } as const;

  const dim = $derived(dimensions[size]);
  const travel = $derived(dim.width - dim.height + (dim.height - dim.dot) / 2);
  const offset = $derived((dim.height - dim.dot) / 2);
  const thumbX = $derived(checked ? travel : offset);

  function handleClick() {
    if (disabled) return;
    const next = !checked;
    checked = next;
    onChange?.(next);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (disabled) return;
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      handleClick();
    }
  }
</script>

<label class="toggle-label" data-disabled={disabled}>
  <button
    type="button"
    class="toggle-track"
    class:on={checked}
    data-size={size}
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel ?? label}
    {disabled}
    onclick={handleClick}
    onkeydown={handleKeydown}
  >
    <span class="toggle-thumb" data-size={size} style:transform={`translate(${thumbX}px, -50%)`}></span>
  </button>
  {#if label}<span class="label-text">{label}</span>{/if}
</label>

<style>
  .toggle-label {
    display: inline-flex;
    align-items: center;
    gap: 0.5em;
    cursor: pointer;
    user-select: none;
    font-size: 0.85em;
    color: var(--colour-text);
  }

  .toggle-label[data-disabled="true"] {
    cursor: not-allowed;
    opacity: 0.65;
  }

  .toggle-track {
    position: relative;
    display: inline-block;
    flex-shrink: 0;
    padding: 0;
    border: 1px solid var(--colour-border);
    border-radius: 999px;
    background: var(--colour-border);
    box-shadow: inset 0 1px 2px rgb(from var(--colour-text) r g b / 0.1);
    cursor: pointer;
    transition:
      background 0.2s,
      border-color 0.2s,
      box-shadow 0.2s;
  }

  .toggle-track:disabled {
    cursor: not-allowed;
  }

  .toggle-track[data-size="md"] {
    width: 36px;
    height: 20px;
  }

  .toggle-track[data-size="sm"] {
    width: 28px;
    height: 16px;
  }

  .toggle-track.on {
    background: linear-gradient(180deg, color-mix(in oklch, var(--accent-base) 85%, white 15%) 0%, var(--accent-base) 100%);
    border-color: color-mix(in oklch, var(--accent-base) 80%, black 20%);
    box-shadow:
      0 1px 3px rgb(from var(--accent-base) r g b / 0.35),
      inset 0 1px 0 rgb(255 255 255 / 0.1);
  }

  .toggle-track:focus-visible {
    outline: 2px solid var(--accent-base);
    outline-offset: 2px;
  }

  .toggle-thumb {
    position: absolute;
    top: 50%;
    left: 0;
    border-radius: 50%;
    background: white;
    box-shadow:
      0 1px 3px rgb(from var(--colour-text) r g b / 0.2),
      0 0 0 0.5px rgb(from var(--colour-text) r g b / 0.1);
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    pointer-events: none;
  }

  .toggle-thumb[data-size="md"] {
    width: 14px;
    height: 14px;
  }

  .toggle-thumb[data-size="sm"] {
    width: 11px;
    height: 11px;
  }

  .label-text {
    font-weight: 500;
  }
</style>
