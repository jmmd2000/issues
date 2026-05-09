import { describe, it, expect, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import StatusPicker from "./StatusPicker.svelte";
import { makeStatus } from "$lib/test-utils/fixtures";

const statuses = [
  makeStatus({ id: "s-backlog", name: "Backlog", slug: "backlog", category: "backlog" }),
  makeStatus({ id: "s-active", name: "In Progress", slug: "in-progress", category: "active" }),
  makeStatus({ id: "s-done", name: "Done", slug: "done", category: "done" }),
];

describe("StatusPicker", () => {
  it("renders the current status name in single mode", async () => {
    const screen = render(StatusPicker, { statuses, value: "s-active" });
    await expect.element(screen.getByRole("button", { name: /status/i })).toBeVisible();
    await expect.element(screen.getByText("In Progress")).toBeVisible();
  });

  it("opens the menu and lists every status", async () => {
    const screen = render(StatusPicker, { statuses, value: "s-active" });
    await screen.getByRole("button", { name: /status/i }).click();
    for (const name of ["Backlog", "In Progress", "Done"]) {
      await expect.element(screen.getByRole("option", { name })).toBeVisible();
    }
  });

  it("calls onselect with the new and previous status when picked", async () => {
    const onselect = vi.fn();
    const screen = render(StatusPicker, { statuses, value: "s-active", onselect });
    await screen.getByRole("button", { name: /status/i }).click();
    await screen.getByRole("option", { name: "Done" }).click();
    expect(onselect).toHaveBeenCalledWith("s-done", "s-active");
  });

  it("renders multi-mode chips for selected statuses", async () => {
    const screen = render(StatusPicker, { statuses, multi: true, selected: ["s-backlog", "s-done"] });
    await expect.element(screen.getByText("Backlog")).toBeVisible();
    await expect.element(screen.getByText("Done")).toBeVisible();
  });

  it("calls onChange with toggled selection in multi mode", async () => {
    const onChange = vi.fn();
    const screen = render(StatusPicker, { statuses, multi: true, selected: [], onChange });
    await screen.getByRole("button", { name: /status/i }).click();
    await screen.getByRole("option", { name: "In Progress" }).click();
    expect(onChange).toHaveBeenCalledWith(["s-active"]);
  });

  it("renders a saving spinner while loading", async () => {
    const screen = render(StatusPicker, { statuses, value: "s-active", loading: true });
    await expect.element(screen.getByLabelText("Saving status")).toBeVisible();
  });
});
