import { describe, it, expect, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { userEvent } from "vitest/browser";
import ColourPicker from "./ColourPicker.svelte";

async function openPicker(onchange = vi.fn()) {
  const screen = await render(ColourPicker, { props: { value: "#355dd4", ariaLabel: "Colour", onchange } });
  await screen.getByRole("button", { name: "Colour" }).click();
  return { screen, onchange };
}

describe("ColourPicker", () => {
  it("applies a typed hex colour in full six-digit form", async () => {
    const { screen, onchange } = await openPicker();

    await screen.getByLabelText("Hex").fill("#f80");
    await userEvent.keyboard("{Enter}");

    expect(onchange).toHaveBeenCalledWith("#ff8800");
  });

  it("refuses a hex colour that is not valid and marks the field", async () => {
    const { screen, onchange } = await openPicker();

    await screen.getByLabelText("Hex").fill("#12345");
    await userEvent.keyboard("{Enter}");

    expect(onchange).not.toHaveBeenCalled();
    await expect.element(screen.getByLabelText("Hex")).toHaveAttribute("aria-invalid", "true");
  });

  it("applies a palette colour and closes", async () => {
    const { screen, onchange } = await openPicker();

    await screen.getByRole("button", { name: "#059669" }).click();

    expect(onchange).toHaveBeenCalledWith("#059669");
    await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
  });
});
