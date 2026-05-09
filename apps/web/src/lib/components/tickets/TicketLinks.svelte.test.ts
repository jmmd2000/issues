import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "vitest-browser-svelte";
import { makeTicketLink } from "$lib/test-utils/fixtures";

vi.mock("$lib/api/client", async () => {
  const { createMockClient } = await import("$lib/test-utils/mockClient");
  const client = createMockClient();
  return { client, createClient: () => client };
});

import TicketLinks from "./TicketLinks.svelte";

const baseProps = {
  links: [],
  projectKey: "TEST",
  ticketNumber: 1,
  onmutated: vi.fn().mockResolvedValue(undefined),
};

describe("TicketLinks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the empty state when there are no links", async () => {
    const screen = render(TicketLinks, { ...baseProps });
    await expect.element(screen.getByText("No links.")).toBeVisible();
  });

  it("groups links by their rendered direction label", async () => {
    const links = [
      makeTicketLink({
        id: "l-out",
        linkType: "blocks",
        direction: "outgoing",
        ticket: { id: "t2", number: 2, title: "Blocked thing", projectKey: "TEST", status: { name: "Backlog", category: "backlog" }, priority: "medium", assignee: null },
      }),
      makeTicketLink({
        id: "l-in",
        linkType: "blocks",
        direction: "incoming",
        ticket: { id: "t3", number: 3, title: "Blocking thing", projectKey: "TEST", status: { name: "Backlog", category: "backlog" }, priority: "medium", assignee: null },
      }),
    ];
    const screen = render(TicketLinks, { ...baseProps, links });
    await expect.element(screen.getByText("blocks")).toBeVisible();
    await expect.element(screen.getByText("is blocked by")).toBeVisible();
    await expect.element(screen.getByText("Blocked thing")).toBeVisible();
    await expect.element(screen.getByText("Blocking thing")).toBeVisible();
  });

  it("opens the add-link form when the plus button is clicked", async () => {
    const screen = render(TicketLinks, { ...baseProps });
    await screen.getByRole("button", { name: "Add link" }).click();
    await expect.element(screen.getByLabelText("Link type")).toBeVisible();
    await expect.element(screen.getByPlaceholder("Search tickets...")).toBeVisible();
  });

  it("disables the Add submit until a ticket is selected", async () => {
    const screen = render(TicketLinks, { ...baseProps });
    await screen.getByRole("button", { name: "Add link" }).click();
    await expect.element(screen.getByRole("button", { name: "Add", exact: true })).toBeDisabled();
  });

  it("closes the add-link form when Cancel is clicked", async () => {
    const screen = render(TicketLinks, { ...baseProps });
    await screen.getByRole("button", { name: "Add link" }).click();
    await screen.getByRole("button", { name: "Cancel" }).click();
    expect(screen.getByPlaceholder("Search tickets...").elements()).toHaveLength(0);
  });

  it("renders a remove button per link with an accessible label", async () => {
    const links = [
      makeTicketLink({
        id: "l1",
        linkType: "blocks",
        direction: "outgoing",
        ticket: { id: "t2", number: 2, title: "Other", projectKey: "TEST", status: { name: "Backlog", category: "backlog" }, priority: "medium", assignee: null },
      }),
    ];
    const screen = render(TicketLinks, { ...baseProps, links });
    await expect.element(screen.getByRole("button", { name: /Remove blocks TEST-2/ })).toBeVisible();
  });
});
