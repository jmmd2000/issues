// Rune-backed toast store. push() returns the new toast id so callers can
// dismiss programmatically (e.g. after the action they triggered finishes).

export type ToastKind = "info" | "error" | "success";

export interface ToastAction {
  label: string;
  run: () => void | Promise<void>;
}

export interface Toast {
  id: string;
  message: string;
  kind: ToastKind;
  action: ToastAction | null;
  ttl: number;
}

export interface PushToastInput {
  message: string;
  kind?: ToastKind;
  /**
   * When provided, the toast renders an action button and becomes sticky --
   * it stays on screen until the user invokes the action or dismisses it.
   * This guarantees affordances like Undo / View are never yanked away
   * mid-decision.
   */
  action?: ToastAction;
  /**
   * Auto-dismiss timeout in milliseconds. Defaults to {@link DEFAULT_TTL_MS}.
   * Pass `0` (or any non-positive number) to opt out of auto-dismiss.
   * Ignored when `action` is set: action toasts are always sticky.
   */
  ttl?: number;
}

/** Default lifetime for plain toasts in milliseconds. */
export const DEFAULT_TTL_MS = 5000;
/** Hard cap on stack size. Older toasts are evicted (and their timers cleared) so a stuck action toast can't pin the list open forever. */
export const MAX_TOASTS = 10;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function makeID(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

class ToastStore {
  toasts = $state<Toast[]>([]);

  push(input: PushToastInput): string {
    const id = makeID();
    const toast: Toast = {
      id,
      message: input.message,
      kind: input.kind ?? "info",
      action: input.action ?? null,
      ttl: input.ttl ?? DEFAULT_TTL_MS,
    };
    const next = [...this.toasts, toast];
    while (next.length > MAX_TOASTS) {
      const evicted = next.shift();
      if (!evicted) break;
      const handle = timers.get(evicted.id);
      if (handle) {
        clearTimeout(handle);
        timers.delete(evicted.id);
      }
    }
    this.toasts = next;

    // Sticky while an action is pending so the user always has time to undo.
    if (!toast.action && toast.ttl > 0) {
      const handle = setTimeout(() => this.dismiss(id), toast.ttl);
      timers.set(id, handle);
    }

    return id;
  }

  dismiss(id: string): void {
    const handle = timers.get(id);
    if (handle) {
      clearTimeout(handle);
      timers.delete(id);
    }
    this.toasts = this.toasts.filter((toast) => toast.id !== id);
  }

  async invokeAction(id: string): Promise<void> {
    const toast = this.toasts.find((entry) => entry.id === id);
    if (!toast?.action) return;
    try {
      await toast.action.run();
    } finally {
      this.dismiss(id);
    }
  }
}

export const toastStore = new ToastStore();

export function pushToast(input: PushToastInput): string {
  return toastStore.push(input);
}
