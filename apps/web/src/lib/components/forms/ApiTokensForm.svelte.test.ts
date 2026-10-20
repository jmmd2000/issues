import { describe, it, expect, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import ApiTokensForm from "./ApiTokensForm.svelte";

function makeToken(id: string, name: string) {
  const inThirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  return { id, name, lastUsedAt: null, expiresAt: inThirtyDays, createdAt: "2026-10-01T00:00:00.000Z" };
}

describe("ApiTokensForm", () => {
  it("keeps every new token on screen until it is dismissed", async () => {
    const onCreate = vi.fn(async (name: string) => ({ ok: true as const, token: `secret-${name}`, apiToken: makeToken(name, name) }));
    const screen = await render(ApiTokensForm, { tokens: [], onCreate, onRevoke: vi.fn() });

    for (const name of ["First", "Second"]) {
      await screen.getByLabelText("Name").fill(name);
      await screen.getByRole("button", { name: "Create token" }).click();
    }

    await expect.element(screen.getByText("secret-First")).toBeInTheDocument();
    await expect.element(screen.getByText("secret-Second")).toBeInTheDocument();

    await screen.getByRole("button", { name: "Dismiss" }).first().click();
    expect(screen.getByText("secret-Second").elements()).toHaveLength(0);
    await expect.element(screen.getByText("secret-First")).toBeInTheDocument();
  });

  it("creates a token with the chosen expiry, 90 days by default", async () => {
    const onCreate = vi.fn(async (name: string) => ({ ok: true as const, token: "secret", apiToken: makeToken(`id-${name}`, name) }));
    const screen = await render(ApiTokensForm, { tokens: [], onCreate, onRevoke: vi.fn() });

    await screen.getByLabelText("Name").fill("Default");
    await screen.getByRole("button", { name: "Create token" }).click();
    await screen.getByLabelText("Name").fill("Short");
    await screen.getByRole("radio", { name: "7 days" }).click();
    await screen.getByRole("button", { name: "Create token" }).click();

    expect(onCreate).toHaveBeenNthCalledWith(1, "Default", 90);
    expect(onCreate).toHaveBeenNthCalledWith(2, "Short", 7);
  });

  it("asks in the row before it revokes, and Cancel keeps the token", async () => {
    const onRevoke = vi.fn(async () => ({ ok: true as const }));
    const screen = await render(ApiTokensForm, { tokens: [makeToken("t-1", "CI deploy")], onCreate: vi.fn(), onRevoke });

    await screen.getByRole("button", { name: "Revoke token CI deploy" }).click();
    await expect.element(screen.getByText("Revoke CI deploy?")).toBeInTheDocument();
    expect(onRevoke).not.toHaveBeenCalled();

    await screen.getByRole("button", { name: "Cancel" }).click();
    expect(screen.getByText("Revoke CI deploy?").elements()).toHaveLength(0);
    expect(onRevoke).not.toHaveBeenCalled();

    await screen.getByRole("button", { name: "Revoke token CI deploy" }).click();
    await screen.getByRole("button", { name: "Revoke", exact: true }).click();
    expect(onRevoke).toHaveBeenCalledWith("t-1");
  });
});
