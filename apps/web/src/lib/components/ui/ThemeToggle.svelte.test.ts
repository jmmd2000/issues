import { describe, it, expect, afterEach } from "vitest";
import { render } from "vitest-browser-svelte";
import ThemeToggle from "./ThemeToggle.svelte";

afterEach(() => {
  localStorage.removeItem("theme");
  delete document.documentElement.dataset.theme;
});

describe("ThemeToggle", () => {
  it("switches to the other theme on each click and saves the choice", async () => {
    document.documentElement.dataset.theme = "dark";
    const screen = await render(ThemeToggle);
    const button = screen.getByRole("button", { name: "Switch between light and dark theme" });

    await button.click();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("theme")).toBe("light");

    await button.click();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });
});
