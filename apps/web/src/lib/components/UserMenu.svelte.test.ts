import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "vitest-browser-svelte";

vi.mock("$lib/api/client", async () => {
  const { createMockClient } = await import("$lib/test-utils/mockClient");
  const client = createMockClient();
  return { client, createClient: () => client };
});

vi.mock("$app/navigation", () => ({
  goto: vi.fn(),
  invalidateAll: vi.fn().mockResolvedValue(undefined),
}));

import UserMenu from "./UserMenu.svelte";

const user = { id: "u-1", name: "Ada Lovelace", email: "ada@example.com", avatarURL: null, createdAt: "2026-01-01T00:00:00.000Z" };

afterEach(() => {
  localStorage.removeItem("theme");
  delete document.documentElement.dataset.theme;
});

describe("UserMenu", () => {
  it("shows who is signed in and where each link goes", async () => {
    const screen = await render(UserMenu, { user });
    await screen.getByRole("button", { name: /Ada Lovelace/ }).click();

    await expect.element(screen.getByText("ada@example.com")).toBeInTheDocument();
    await expect.element(screen.getByRole("menuitem", { name: "Account settings" })).toHaveAttribute("href", "/settings");
    await expect.element(screen.getByRole("menuitem", { name: "API tokens" })).toHaveAttribute("href", "/settings#tokens");
  });

  it("switches the theme and keeps the menu open", async () => {
    const screen = await render(UserMenu, { user });
    await screen.getByRole("button", { name: /Ada Lovelace/ }).click();
    await screen.getByRole("radio", { name: "Dark" }).click();

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
    await expect.element(screen.getByRole("menu")).toBeInTheDocument();
    await expect.element(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
  });
});
