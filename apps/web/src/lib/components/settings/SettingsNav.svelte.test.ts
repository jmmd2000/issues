import { describe, it, expect, afterEach } from "vitest";
import { render } from "vitest-browser-svelte";
import SettingsNav from "./SettingsNav.svelte";

const sections = [
  { id: "profile", label: "Profile" },
  { id: "tokens", label: "API tokens" },
  { id: "about", label: "About" },
];

function addSections() {
  for (const section of sections) {
    const element = document.createElement("section");
    element.id = section.id;
    element.style.height = "40px";
    document.body.appendChild(element);
  }
}

afterEach(() => {
  for (const section of sections) document.getElementById(section.id)?.remove();
});

describe("SettingsNav", () => {
  it("keeps a chosen section marked while the page scrolls, even if it cannot reach the top", async () => {
    addSections();
    const screen = await render(SettingsNav, { sections });
    await screen.getByRole("link", { name: "API tokens" }).click();
    window.dispatchEvent(new Event("scroll"));

    await expect.element(screen.getByRole("link", { name: "API tokens" })).toHaveAttribute("aria-current", "true");
    await expect.element(screen.getByRole("link", { name: "About" })).not.toHaveAttribute("aria-current");
  });

  it("goes back to following the scroll once the person scrolls by hand", async () => {
    addSections();
    const screen = await render(SettingsNav, { sections });
    await screen.getByRole("link", { name: "API tokens" }).click();
    window.dispatchEvent(new Event("wheel"));
    window.dispatchEvent(new Event("scroll"));

    await expect.element(screen.getByRole("link", { name: "About" })).toHaveAttribute("aria-current", "true");
  });
});
