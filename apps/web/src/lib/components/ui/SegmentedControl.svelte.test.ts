import { describe, it, expect, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { userEvent } from "vitest/browser";
import SegmentedControl from "./SegmentedControl.svelte";

const options = [
  { value: "list", label: "List" },
  { value: "board", label: "Board" },
  { value: "table", label: "Table" },
];

describe("SegmentedControl", () => {
  it("moves the choice with the arrow keys and wraps at both ends", async () => {
    const onchange = vi.fn();
    const screen = await render(SegmentedControl, { options, value: "list", label: "Layout", onchange });
    screen.getByRole("radio", { name: "List" }).element().focus();

    await userEvent.keyboard("{ArrowLeft}");
    await expect.element(screen.getByRole("radio", { name: "Table" })).toBeChecked();
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(screen.getByRole("radio", { name: "List" })).toBeChecked();
    expect(onchange).toHaveBeenNthCalledWith(1, "table", "list");
    expect(onchange).toHaveBeenNthCalledWith(2, "list", "table");
  });

  it("jumps to the first and last option with Home and End", async () => {
    const screen = await render(SegmentedControl, { options, value: "board", label: "Layout" });
    screen.getByRole("radio", { name: "Board" }).element().focus();

    await userEvent.keyboard("{End}");
    await expect.element(screen.getByRole("radio", { name: "Table" })).toBeChecked();
    await userEvent.keyboard("{Home}");
    await expect.element(screen.getByRole("radio", { name: "List" })).toBeChecked();
  });

  it("keeps only the chosen option in the tab order", async () => {
    const screen = await render(SegmentedControl, { options, value: "board", label: "Layout" });
    await expect.element(screen.getByRole("radio", { name: "Board" })).toHaveAttribute("tabindex", "0");
    await expect.element(screen.getByRole("radio", { name: "List" })).toHaveAttribute("tabindex", "-1");
  });
});
