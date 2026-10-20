import { describe, it, expect, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import type { TicketChild } from "@issues/api";
import { makeStatus, makeMember } from "$lib/test-utils/fixtures";

vi.mock("$lib/api/client", async () => {
  const { createMockClient } = await import("$lib/test-utils/mockClient");
  const client = createMockClient();
  return { client, createClient: () => client };
});

import TicketChildren from "./TicketChildren.svelte";

function makeChild(overrides: Partial<TicketChild> = {}): TicketChild {
  return {
    id: "c-1",
    number: 1,
    title: "First child",
    priority: "medium",
    statusID: "s-backlog",
    status: { id: "s-backlog", name: "Backlog", category: "backlog" },
    assignee: null,
    ...overrides,
  };
}

const baseProps = {
  projectKey: "TEST",
  parentTicketID: "p-1",
  parentTicketNumber: 7,
  parentTicketTitle: "Parent ticket",
  statuses: [makeStatus()],
  labels: [],
  members: [makeMember()],
  currentUserID: "u-1",
  onmutated: () => Promise.resolve(),
};

describe("TicketChildren", () => {
  it("counts both done and cancelled children toward completion", async () => {
    const children = [
      makeChild({ id: "c-1", number: 11, status: { id: "s-1", name: "Done", category: "done" } }),
      makeChild({ id: "c-2", number: 12, status: { id: "s-2", name: "Cancelled", category: "cancelled" } }),
    ];
    const screen = await render(TicketChildren, { ...baseProps, children });
    await expect.element(screen.getByText("2 / 2 done")).toBeVisible();
  });
});
