import { afterEach, describe, expect, it, vi } from "vitest";
import { pushToast, toastStore } from "../toast.svelte";

afterEach(() => {
  // Hard reset between tests so cross-test state doesn't leak through the
  // module-singleton store.
  toastStore.toasts = [];
  vi.useRealTimers();
});

describe("toast store", () => {
  it("appends a toast on push and clears it on dismiss", () => {
    const id = pushToast({ message: "Hello" });
    expect(toastStore.toasts).toHaveLength(1);
    expect(toastStore.toasts[0]).toMatchObject({ id, message: "Hello", kind: "info", action: null });

    toastStore.dismiss(id);
    expect(toastStore.toasts).toHaveLength(0);
  });

  it("auto-dismisses non-action toasts after their ttl", () => {
    vi.useFakeTimers();
    pushToast({ message: "Bye soon", ttl: 200 });
    expect(toastStore.toasts).toHaveLength(1);
    vi.advanceTimersByTime(199);
    expect(toastStore.toasts).toHaveLength(1);
    vi.advanceTimersByTime(2);
    expect(toastStore.toasts).toHaveLength(0);
  });

  it("does not auto-dismiss action toasts (sticky until invoked)", () => {
    vi.useFakeTimers();
    pushToast({ message: "Undo me", ttl: 100, action: { label: "Undo", run: () => {} } });
    vi.advanceTimersByTime(500);
    expect(toastStore.toasts).toHaveLength(1);
  });

  it("invokes the action and dismisses the toast on invokeAction", async () => {
    const run = vi.fn();
    const id = pushToast({ message: "Click me", action: { label: "Go", run } });
    await toastStore.invokeAction(id);
    expect(run).toHaveBeenCalledOnce();
    expect(toastStore.toasts).toHaveLength(0);
  });

  it("dismisses even when the action throws", async () => {
    const run = vi.fn(() => {
      throw new Error("boom");
    });
    const id = pushToast({ message: "Will fail", action: { label: "Try", run } });
    await expect(toastStore.invokeAction(id)).rejects.toThrow("boom");
    expect(toastStore.toasts).toHaveLength(0);
  });
});
