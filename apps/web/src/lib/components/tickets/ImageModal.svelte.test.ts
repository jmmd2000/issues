import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import type { Attachment } from "@issues/api";
import ImageModal from "./ImageModal.svelte";

function makeImage(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: "00000000-0000-0000-0000-0000000000a1",
    ticketID: "00000000-0000-0000-0000-0000000000t1",
    commentID: null,
    uploaderID: "00000000-0000-0000-0000-0000000000u1",
    filename: "screenshot.png",
    storageKey: "abc/screenshot.png",
    contentHash: "deadbeef",
    sizeBytes: 12_345,
    width: 800,
    height: 600,
    mimeType: "image/png",
    isImage: true,
    createdAt: "2026-05-01T10:00:00.000Z",
    url: "/uploads/abc-screenshot.png",
    uploader: { id: "00000000-0000-0000-0000-0000000000u1", name: "Alex", avatarURL: null },
    ...overrides,
  };
}

describe("ImageModal", () => {
  it("renders the image, filename, and an open-original link when open", async () => {
    const attachment = makeImage({ filename: "diagram.png", sizeBytes: 1_500_000 });
    const screen = render(ImageModal, { open: true, attachment, onclose: () => {} });

    await expect.element(screen.getByRole("img", { name: "diagram.png" })).toBeVisible();
    await expect.element(screen.getByText("diagram.png")).toBeVisible();
    await expect.element(screen.getByText("1.5 MB")).toBeVisible();
    await expect.element(screen.getByRole("link", { name: "Open original" })).toBeVisible();
  });

  it("invokes onclose when the close button is clicked", async () => {
    const attachment = makeImage();
    let closed = false;
    const screen = render(ImageModal, { open: true, attachment, onclose: () => (closed = true) });

    await screen.getByRole("button", { name: "Close" }).click();
    expect(closed).toBe(true);
  });

  it("renders nothing inside the dialog when there is no attachment", async () => {
    const screen = render(ImageModal, { open: true, attachment: null, onclose: () => {} });

    await expect.element(screen.getByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });

  it("closes when the caption area is clicked", async () => {
    const attachment = makeImage({ filename: "diagram.png" });
    let closed = false;
    const screen = render(ImageModal, { open: true, attachment, onclose: () => (closed = true) });

    await screen.getByText("diagram.png").click();
    expect(closed).toBe(true);
  });

  it("does not close when the image itself is clicked", async () => {
    const attachment = makeImage({ filename: "diagram.png" });
    let closed = false;
    const screen = render(ImageModal, { open: true, attachment, onclose: () => (closed = true) });

    await screen.getByRole("img", { name: "diagram.png" }).click();
    expect(closed).toBe(false);
  });
});
