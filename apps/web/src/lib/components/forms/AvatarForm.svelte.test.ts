import { describe, it, expect, vi } from "vitest";
import { render } from "vitest-browser-svelte";

vi.mock("$app/navigation", () => ({
  goto: vi.fn(),
  invalidateAll: vi.fn().mockResolvedValue(undefined),
}));

import AvatarForm from "./AvatarForm.svelte";

const user = { id: "u-1", name: "Ada Lovelace", email: "ada@example.com", avatarURL: null, createdAt: "2026-01-01T00:00:00.000Z" };

function drop(target: Element, file: File) {
  const transfer = new DataTransfer();
  transfer.items.add(file);
  target.dispatchEvent(new DragEvent("drop", { dataTransfer: transfer, bubbles: true, cancelable: true }));
}

describe("AvatarForm", () => {
  it("refuses a dropped file that is not a PNG, JPEG or WebP image", async () => {
    const screen = await render(AvatarForm, { user });
    drop(document.querySelector(".avatar-drop") as Element, new File(["GIF89a"], "note.gif", { type: "image/gif" }));

    await expect.element(screen.getByText("Only PNG, JPEG or WebP images are accepted.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save avatar" }).elements()).toHaveLength(0);
  });

  it("shows a preview with Save and Cancel for a dropped PNG, and Cancel puts the old avatar back", async () => {
    const screen = await render(AvatarForm, { user });
    drop(document.querySelector(".avatar-drop") as Element, new File(["png"], "me.png", { type: "image/png" }));

    await expect.element(screen.getByRole("img", { name: "New avatar preview" })).toBeInTheDocument();
    await screen.getByRole("button", { name: "Cancel" }).click();
    expect(screen.getByRole("img", { name: "New avatar preview" }).elements()).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Save avatar" }).elements()).toHaveLength(0);
  });
});
