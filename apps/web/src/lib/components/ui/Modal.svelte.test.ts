import { describe, it, expect, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { createRawSnippet } from "svelte";
import Modal from "./Modal.svelte";

const bodySnippet = createRawSnippet(() => ({
  render: () => `<p data-testid="modal-body">Modal contents</p>`,
}));

describe("Modal", () => {
  it("calls onclose when the close button is clicked", async () => {
    const onclose = vi.fn();
    const screen = await render(Modal, { open: true, title: "Open", onclose, children: bodySnippet });
    await screen.getByRole("button", { name: "Close" }).click();
    expect(onclose).toHaveBeenCalledOnce();
  });

  it("hides the close button when showCloseButton is false", async () => {
    const screen = await render(Modal, { open: true, title: "Open", onclose: () => {}, showCloseButton: false, children: bodySnippet });
    expect(screen.getByRole("button", { name: "Close" }).elements()).toHaveLength(0);
  });

  it("calls onclose when the mouse goes down and comes up on the backdrop", async () => {
    const onclose = vi.fn();
    await render(Modal, { open: true, title: "Open", onclose, children: bodySnippet });
    const dialog = document.querySelector("dialog");
    dialog?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    dialog?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onclose).toHaveBeenCalledOnce();
  });

  it("stays open when a press starts inside the dialog and ends on the backdrop", async () => {
    const onclose = vi.fn();
    const screen = await render(Modal, { open: true, title: "Open", onclose, children: bodySnippet });
    screen
      .getByTestId("modal-body")
      .element()
      .dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    document.querySelector("dialog")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onclose).not.toHaveBeenCalled();
  });
});
