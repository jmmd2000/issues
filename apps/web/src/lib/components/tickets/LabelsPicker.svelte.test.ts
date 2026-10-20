import { describe, it, expect, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import LabelsPicker from "./LabelsPicker.svelte";
import { makeLabel } from "$lib/test-utils/fixtures";

const labels = [
  makeLabel({ id: "l-bug", name: "bug", colour: "#ff5555" }),
  makeLabel({ id: "l-docs", name: "docs", colour: "#55aaff" }),
  makeLabel({ id: "l-feature", name: "feature", colour: "#55ff77" }),
];

describe("LabelsPicker", () => {
  it("opens the menu and lists all labels", async () => {
    const screen = await render(LabelsPicker, { labels, value: [] });
    await screen.getByRole("button", { name: /labels/i }).click();
    for (const name of ["bug", "docs", "feature"]) {
      await expect.element(screen.getByRole("option", { name })).toBeVisible();
    }
  });

  it("filters labels by the search input", async () => {
    const screen = await render(LabelsPicker, { labels, value: [] });
    await screen.getByRole("button", { name: /labels/i }).click();
    await screen.getByPlaceholder("Search labels...").fill("doc");
    await expect.element(screen.getByRole("option", { name: "docs" })).toBeVisible();
    expect(screen.getByRole("option").elements()).toHaveLength(1);
  });

  it("toggles selection via onChange when provided", async () => {
    const onChange = vi.fn();
    const screen = await render(LabelsPicker, { labels, value: [], onChange });
    await screen.getByRole("button", { name: /labels/i }).click();
    await screen.getByRole("option", { name: "feature" }).click();
    expect(onChange).toHaveBeenCalledWith(["l-feature"]);
  });
});
