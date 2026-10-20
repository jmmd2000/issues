<script lang="ts">
  import { Eye, EyeOff } from "@lucide/svelte";

  let {
    id,
    label,
    value = $bindable(""),
    autocomplete,
    error,
  }: {
    id: string;
    label: string;
    value?: string;
    autocomplete: "current-password" | "new-password";
    error?: string;
  } = $props();

  let visible = $state(false);
</script>

<div class="password-field">
  <label for={id} class="form-label">{label}</label>
  <div class="input-wrap">
    <input {id} class="form-input" type={visible ? "text" : "password"} bind:value {autocomplete} aria-invalid={error ? "true" : undefined} aria-describedby={error ? `${id}-error` : undefined} />
    <button type="button" class="reveal" aria-pressed={visible} aria-label="{visible ? 'Hide' : 'Show'} {label.toLowerCase()}" onclick={() => (visible = !visible)}>
      {#if visible}<EyeOff size={14} strokeWidth={2} />{:else}<Eye size={14} strokeWidth={2} />{/if}
    </button>
  </div>
  {#if error}<span id="{id}-error" class="field-error">{error}</span>{/if}
</div>

<style>
  .input-wrap {
    position: relative;
    display: flex;

    & .form-input {
      padding-right: 2.5rem;
    }
  }

  .reveal {
    position: absolute;
    top: 50%;
    right: 0.25rem;
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    border: 0;
    border-radius: var(--border-radius-inner);
    background: transparent;
    color: var(--colour-muted);
    cursor: pointer;
    translate: 0 -50%;

    &:hover {
      background: var(--colour-bg-hover);
      color: var(--colour-text);
    }
  }
</style>
