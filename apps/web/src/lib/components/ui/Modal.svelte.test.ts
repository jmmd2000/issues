import { describe, it, expect, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { createRawSnippet } from "svelte";
import Modal from "./Modal.svelte";

const bodySnippet = createRawSnippet(() => ({
  render: () => `<p data-testid="modal-body">Modal contents</p>`,
}));

describe("Modal", () => {
  it("hides the body when closed", async () => {
    const screen = render(Modal, { open: false, title: "Closed", onclose: () => {}, children: bodySnippet });
    await expect.element(screen.getByTestId("modal-body")).not.toBeVisible();
  });

  it("renders title, body, and close button when open", async () => {
    const screen = render(Modal, { open: true, title: "Open", onclose: () => {}, children: bodySnippet });
    await expect.element(screen.getByRole("heading", { name: "Open" })).toBeVisible();
    await expect.element(screen.getByTestId("modal-body")).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Close" })).toBeVisible();
  });

  it("calls onclose when the close button is clicked", async () => {
    const onclose = vi.fn();
    const screen = render(Modal, { open: true, title: "Open", onclose, children: bodySnippet });
    await screen.getByRole("button", { name: "Close" }).click();
    expect(onclose).toHaveBeenCalledOnce();
  });

  it("hides the close button when showCloseButton is false", async () => {
    const screen = render(Modal, { open: true, title: "Open", onclose: () => {}, showCloseButton: false, children: bodySnippet });
    expect(screen.getByRole("button", { name: "Close" }).elements()).toHaveLength(0);
  });

  it("renders a footer when the footer snippet is provided", async () => {
    const footer = createRawSnippet(() => ({
      render: () => `<button type="button" data-testid="footer-action">Save</button>`,
    }));
    const screen = render(Modal, { open: true, title: "Open", onclose: () => {}, children: bodySnippet, footer });
    await expect.element(screen.getByTestId("footer-action")).toBeVisible();
  });
});
