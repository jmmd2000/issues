import { describe, it, expect } from "vitest";
import { render } from "vitest-browser-svelte";
import { userEvent } from "vitest/browser";
import PopoverHarness from "$lib/test-utils/PopoverHarness.svelte";

async function renderOpenedByKeyboard() {
  const screen = await render(PopoverHarness);
  screen.getByRole("button", { name: "Open menu" }).element().focus();
  await userEvent.keyboard("{Enter}");
  return screen;
}

describe("Popover keyboard support", () => {
  it("opens with the arrow keys from the trigger and focuses the first item", async () => {
    const screen = await render(PopoverHarness);
    screen.getByRole("button", { name: "Open menu" }).element().focus();
    await userEvent.keyboard("{ArrowDown}");
    await expect.element(screen.getByRole("menuitem", { name: "One" })).toHaveFocus();
  });

  it("moves between items with Up, Down, Home and End, and wraps at both ends", async () => {
    const screen = await renderOpenedByKeyboard();
    await expect.element(screen.getByRole("menuitem", { name: "One" })).toHaveFocus();

    await userEvent.keyboard("{ArrowUp}");
    await expect.element(screen.getByRole("menuitem", { name: "Three" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    await expect.element(screen.getByRole("menuitem", { name: "One" })).toHaveFocus();
    await userEvent.keyboard("{End}");
    await expect.element(screen.getByRole("menuitem", { name: "Three" })).toHaveFocus();
    await userEvent.keyboard("{Home}");
    await expect.element(screen.getByRole("menuitem", { name: "One" })).toHaveFocus();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const screen = await renderOpenedByKeyboard();
    await userEvent.keyboard("{Escape}");
    await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Open menu" })).toHaveFocus();
  });

  it("closes on Tab and lets focus move on", async () => {
    const screen = await renderOpenedByKeyboard();
    await userEvent.keyboard("{Tab}");
    await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });
});
