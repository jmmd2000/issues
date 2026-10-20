import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "vitest-browser-svelte";
import { mockResponse } from "$lib/test-utils/mockClient";

vi.mock("$lib/api/client", async () => {
  const { createMockClient } = await import("$lib/test-utils/mockClient");
  const client = createMockClient();
  return { client, createClient: () => client };
});

import { client } from "$lib/api/client";
import LabelRow from "./LabelRow.svelte";

const label = { id: "l-1", projectID: "p-1", name: "Bug", colour: "#e11d48", ticketCount: 3 };

function props(overrides: Partial<{ ticketCount: number }> = {}) {
  return { label: { ...label, ...overrides }, projectKey: "TEST", onDelete: vi.fn(), onUpdate: vi.fn() };
}

describe("LabelRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("asks in the row, says how many tickets lose the label, and deletes only after Delete", async () => {
    const remove = vi.mocked(client.api.projects[":key"].labels[":id"].$delete);
    remove.mockResolvedValueOnce(mockResponse({}, true, 204) as unknown as Awaited<ReturnType<typeof remove>>);
    const rowProps = props();
    const screen = await render(LabelRow, rowProps);

    await screen.getByRole("button", { name: "Delete label Bug" }).click();
    await expect.element(screen.getByText("Delete Bug? 3 tickets lose it.")).toBeInTheDocument();
    expect(remove).not.toHaveBeenCalled();

    await screen.getByRole("button", { name: "Cancel" }).click();
    expect(screen.getByText("Delete Bug? 3 tickets lose it.").elements()).toHaveLength(0);

    await screen.getByRole("button", { name: "Delete label Bug" }).click();
    await screen.getByRole("button", { name: "Delete", exact: true }).click();
    await vi.waitFor(() => expect(rowProps.onDelete).toHaveBeenCalledWith("l-1"));
    expect(remove).toHaveBeenCalledOnce();
  });
});
