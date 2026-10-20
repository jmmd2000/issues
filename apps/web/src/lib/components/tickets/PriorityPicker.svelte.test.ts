import { describe, it, expect, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import PriorityPicker from "./PriorityPicker.svelte";

describe("PriorityPicker", () => {
  it("opens the menu and shows all options on trigger click", async () => {
    const screen = await render(PriorityPicker, { value: "medium" });
    await screen.getByRole("button", { name: /priority/i }).click();
    for (const label of ["Critical", "High", "Medium", "Low", "None"]) {
      await expect.element(screen.getByRole("option", { name: label })).toBeVisible();
    }
  });

  it("calls onselect with the new and previous value when a different option is picked", async () => {
    const onselect = vi.fn();
    const screen = await render(PriorityPicker, { value: "medium", onselect });
    await screen.getByRole("button", { name: /priority/i }).click();
    await screen.getByRole("option", { name: "High" }).click();
    expect(onselect).toHaveBeenCalledWith("high", "medium");
  });

  it("calls onChange with the toggled value in multi mode", async () => {
    const onChange = vi.fn();
    const screen = await render(PriorityPicker, { multi: true, selected: [], onChange });
    await screen.getByRole("button", { name: /priority/i }).click();
    await screen.getByRole("option", { name: "Critical" }).click();
    expect(onChange).toHaveBeenCalledWith(["critical"]);
  });

  it("renders the trigger as disabled when the disabled prop is set", async () => {
    const screen = await render(PriorityPicker, { value: "medium", disabled: true });
    await expect.element(screen.getByRole("button", { name: "Priority" })).toBeDisabled();
    expect(screen.getByRole("option").elements()).toHaveLength(0);
  });
});
