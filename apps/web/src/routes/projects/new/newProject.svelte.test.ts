import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "vitest-browser-svelte";
import { userEvent } from "vitest/browser";
import { mockResponse } from "$lib/test-utils/mockClient";

vi.mock("$lib/api/client", async () => {
  const { createMockClient } = await import("$lib/test-utils/mockClient");
  const client = createMockClient();
  return { client, createClient: () => client };
});

const goto = vi.fn().mockResolvedValue(undefined);
vi.mock("$app/navigation", () => ({
  goto: (...args: unknown[]) => goto(...args),
  invalidateAll: vi.fn().mockResolvedValue(undefined),
}));

import { client } from "$lib/api/client";
import NewProjectPage from "./+page.svelte";

const user = { id: "u-1", name: "Ada", email: "ada@example.com", avatarURL: null, createdAt: "2026-01-01T00:00:00.000Z" };
const data = { user, existingProjects: [{ key: "DASH", name: "Dashboard Rewrite" }] };

function post() {
  return vi.mocked(client.api.projects.create.$post);
}

async function renderPage() {
  return await render(NewProjectPage, { props: { data, params: {} } });
}

describe("New project page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("suggests a key from the name until the key is edited by hand", async () => {
    const screen = await renderPage();
    const key = screen.getByLabelText("Key");

    await screen.getByLabelText("Project name").fill("Personal website");
    await expect.element(key).toHaveValue("PW");

    await key.fill("web");
    await expect.element(key).toHaveValue("WEB");
    await screen.getByLabelText("Project name").fill("Something else entirely");
    await expect.element(key).toHaveValue("WEB");
  });

  it("names the project that already has the key", async () => {
    const screen = await renderPage();
    await screen.getByLabelText("Key").fill("dash");

    await expect.element(screen.getByText("DASH is already used by Dashboard Rewrite.")).toBeInTheDocument();
  });

  it("creates the project with Ctrl and Enter from the description and opens it at once", async () => {
    post().mockResolvedValueOnce(mockResponse({ project: { key: "PW" } }, true, 201) as unknown as Awaited<ReturnType<ReturnType<typeof post>>>);
    const screen = await renderPage();
    await screen.getByLabelText("Project name").fill("Personal website");
    await screen.getByRole("button", { name: "More options" }).click();
    await screen.getByLabelText(/Description/).fill("My site");
    await userEvent.keyboard("{Control>}{Enter}{/Control}");

    await vi.waitFor(() => expect(post()).toHaveBeenCalledOnce());
    expect(post().mock.calls[0][0].json).toEqual({ key: "PW", name: "Personal website", description: "My site", visibility: "public", showOnHomePage: false, repo: null, stack: [] });
    await vi.waitFor(() => expect(goto).toHaveBeenCalledWith("/projects/PW"));
  });

  it("does not send Show on the home page for a project that is public in the end", async () => {
    post().mockResolvedValueOnce(mockResponse({ project: { key: "PW" } }, true, 201) as unknown as Awaited<ReturnType<ReturnType<typeof post>>>);
    const screen = await renderPage();
    await screen.getByLabelText("Project name").fill("Personal website");
    await screen.getByRole("button", { name: "More options" }).click();
    await screen.getByText("Private", { exact: true }).click();
    await screen.getByRole("switch", { name: "Show on the home page" }).click();
    await screen.getByText("Public", { exact: true }).click();
    await userEvent.keyboard("{Control>}{Enter}{/Control}");

    await vi.waitFor(() => expect(post()).toHaveBeenCalledOnce());
    expect(post().mock.calls[0][0].json).toMatchObject({ visibility: "public", showOnHomePage: false });
  });
});
