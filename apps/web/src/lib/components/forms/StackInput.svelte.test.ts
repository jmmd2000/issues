import { describe, it, expect } from "vitest";
import { render } from "vitest-browser-svelte";
import { userEvent } from "vitest/browser";
import StackInput from "./StackInput.svelte";

describe("StackInput", () => {
  it("adds a chip with Enter, and removes the last one with Backspace on an empty field", async () => {
    const screen = await render(StackInput, { props: { id: "stack", items: [] } });
    const field = screen.getByRole("textbox");

    await field.fill("Rust");
    await userEvent.keyboard("{Enter}");
    await field.fill("Go");
    await userEvent.keyboard("{Enter}");
    await expect.element(screen.getByRole("button", { name: "Remove Rust" })).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Remove Go" })).toBeInTheDocument();

    await userEvent.keyboard("{Backspace}");
    expect(screen.getByRole("button", { name: "Remove Go" }).elements()).toHaveLength(0);
    await expect.element(screen.getByRole("button", { name: "Remove Rust" })).toBeInTheDocument();
  });

  it("offers suggestions that are not already chosen, and a click adds one", async () => {
    const screen = await render(StackInput, { props: { id: "stack", items: ["Hono"] } });

    expect(screen.getByRole("button", { name: "+ Hono" }).elements()).toHaveLength(0);
    await screen.getByRole("button", { name: "+ Zod" }).click();
    await expect.element(screen.getByRole("button", { name: "Remove Zod" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Zod" }).elements()).toHaveLength(0);
  });
});
