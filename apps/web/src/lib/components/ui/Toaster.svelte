<script lang="ts">
  import { CircleCheck, CircleAlert, Info, X } from "@lucide/svelte";
  import { toastStore, type ToastKind } from "$lib/stores/toast.svelte";

  const kindIcons = { success: CircleCheck, error: CircleAlert, info: Info } as const;
  const kindRole: Record<ToastKind, "status" | "alert"> = { success: "status", info: "status", error: "alert" };
</script>

<div class="stack" role="region" aria-live="polite" aria-label="Notifications">
  {#each toastStore.toasts as toast (toast.id)}
    {@const Icon = kindIcons[toast.kind]}
    <div class="toast" data-kind={toast.kind} role={kindRole[toast.kind]}>
      <span class="icon" aria-hidden="true">
        <Icon size={16} strokeWidth={2} />
      </span>

      <span class="message">{toast.message}</span>

      {#if toast.action}
        <button type="button" class="action" onclick={() => void toastStore.invokeAction(toast.id)}>
          {toast.action.label}
        </button>
      {/if}

      <button type="button" class="dismiss" onclick={() => toastStore.dismiss(toast.id)} aria-label="Dismiss">
        <X size={11} strokeWidth={1.6} />
      </button>
    </div>
  {/each}
</div>

<style>
  .stack {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    z-index: 1000;
    display: flex;
    flex-direction: column-reverse;
    gap: 0.5rem;
    pointer-events: none;
  }

  @keyframes slide-in-right {
    from {
      opacity: 0;
      transform: translateX(1rem);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.7rem 0.9rem;
    border-radius: 0.5rem;
    background: var(--colour-bg-lighter);
    border: var(--border);
    box-shadow:
      0 8px 24px rgba(30, 34, 41, 0.15),
      0 2px 8px rgba(30, 34, 41, 0.08);
    animation: slide-in-right 200ms ease;
    min-width: 16rem;
    max-width: 21rem;
  }

  .icon {
    display: inline-flex;
    flex-shrink: 0;
    color: var(--accent-base);
  }

  .toast[data-kind="success"] .icon {
    color: var(--colour-success);
  }

  .toast[data-kind="error"] .icon {
    color: var(--colour-error);
  }

  .message {
    flex: 1;
    font-size: 0.85rem;
    color: var(--colour-text);
    font-weight: 500;
    line-height: 1.4;
  }

  .action {
    border: 0;
    background: transparent;
    color: var(--accent-base);
    font: inherit;
    font-size: 0.8rem;
    font-weight: 700;
    padding: 0.2rem 0.45rem;
    border-radius: var(--border-radius-inner);
    cursor: pointer;
    flex-shrink: 0;
  }

  .action:hover {
    background: var(--accent-tint-900);
  }

  .dismiss {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    line-height: 1;
    border: 0;
    background: transparent;
    color: var(--colour-muted);
    cursor: pointer;
    flex-shrink: 0;
  }

  .dismiss:hover,
  .dismiss:focus-visible {
    color: var(--colour-text);
    outline: none;
  }
</style>
