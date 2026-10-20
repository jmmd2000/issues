import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "vitest-browser-svelte";
import { userEvent } from "vitest/browser";
import { makeStatus } from "$lib/test-utils/fixtures";
import { mockResponse } from "$lib/test-utils/mockClient";

vi.mock("$lib/api/client", async () => {
  const { createMockClient } = await import("$lib/test-utils/mockClient");
  const client = createMockClient();
  return { client, createClient: () => client };
});

import { client } from "$lib/api/client";
import StatusColumn from "./StatusColumn.svelte";

function props() {
  const statuses = [makeStatus({ id: "s-1", name: "Todo", category: "backlog" })];
  return {
    category: "backlog" as const,
    label: "Backlog",
    statuses,
    allStatuses: statuses,
    projectKey: "TEST",
    onConsider: vi.fn(),
    onFinalize: vi.fn(),
    onUpdate: vi.fn(),
    onDelete: vi.fn(),
    onAdd: vi.fn(),
  };
}

describe("StatusColumn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds a status in place with Enter, in the column's own category", async () => {
    const created = makeStatus({ id: "s-2", name: "Icebox", category: "backlog" });
    const post = vi.mocked(client.api.projects[":key"].statuses.$post);
    post.mockResolvedValueOnce(mockResponse({ status: created }, true, 201) as unknown as Awaited<ReturnType<typeof post>>);
    const columnProps = props();
    const screen = await render(StatusColumn, columnProps);

    await screen.getByRole("button", { name: "Add status" }).click();
    await userEvent.keyboard("Icebox{Enter}");

    await vi.waitFor(() => expect(columnProps.onAdd).toHaveBeenCalledWith(created));
    expect(post.mock.calls[0][0].json).toEqual({ name: "Icebox", category: "backlog" });
    await expect.element(screen.getByRole("button", { name: "Add status" })).toBeInTheDocument();
  });

  it("closes the new row on Escape without sending anything", async () => {
    const post = vi.mocked(client.api.projects[":key"].statuses.$post);
    const screen = await render(StatusColumn, props());

    await screen.getByRole("button", { name: "Add status" }).click();
    await userEvent.keyboard("Draft{Escape}");

    await expect.element(screen.getByRole("button", { name: "Add status" })).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });
});
