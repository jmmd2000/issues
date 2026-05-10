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
  it("renders the empty state and Add sub-ticket trigger when there are no children", async () => {
    const screen = render(TicketChildren, { ...baseProps, children: [] });
    await expect.element(screen.getByText("No sub-tickets yet.")).toBeVisible();
    await expect.element(screen.getByRole("button", { name: /Add sub-ticket/ })).toBeVisible();
  });

  it("renders one row per child with status chips", async () => {
    const children = [
      makeChild({ id: "c-1", number: 11, title: "Open child", status: { id: "s-1", name: "Backlog", category: "backlog" } }),
      makeChild({ id: "c-2", number: 12, title: "Closed child", status: { id: "s-2", name: "Done", category: "done" } }),
    ];
    const screen = render(TicketChildren, { ...baseProps, children });
    await expect.element(screen.getByText("Open child")).toBeVisible();
    await expect.element(screen.getByText("Closed child")).toBeVisible();
    await expect.element(screen.getByText("TEST-11")).toBeVisible();
    await expect.element(screen.getByText("TEST-12")).toBeVisible();
  });

  it("renders the progress bar and N / M done label when children exist", async () => {
    const children = [
      makeChild({ id: "c-1", number: 11, status: { id: "s-1", name: "Backlog", category: "backlog" } }),
      makeChild({ id: "c-2", number: 12, status: { id: "s-2", name: "Done", category: "done" } }),
      makeChild({ id: "c-3", number: 13, status: { id: "s-3", name: "Cancelled", category: "cancelled" } }),
    ];
    const screen = render(TicketChildren, { ...baseProps, children });
    await expect.element(screen.getByText("2 / 3 done")).toBeVisible();
    const bar = screen.getByRole("progressbar");
    await expect.element(bar).toHaveAttribute("aria-valuenow", "2");
    await expect.element(bar).toHaveAttribute("aria-valuemax", "3");
  });

  it("counts both done and cancelled children toward completion", async () => {
    const children = [
      makeChild({ id: "c-1", number: 11, status: { id: "s-1", name: "Done", category: "done" } }),
      makeChild({ id: "c-2", number: 12, status: { id: "s-2", name: "Cancelled", category: "cancelled" } }),
    ];
    const screen = render(TicketChildren, { ...baseProps, children });
    await expect.element(screen.getByText("2 / 2 done")).toBeVisible();
  });
});
