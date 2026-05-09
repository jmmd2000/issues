import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "vitest-browser-svelte";
import { makeMember, makeStatus } from "$lib/test-utils/fixtures";

const mockState = vi.hoisted(() => ({
  tickets: [] as Array<{ id: string; number: number; title: string; statusID: string; priority: string; assigneeID: string | null }>,
}));

vi.mock("$lib/api/client", () => ({
  client: {
    api: {
      projects: {
        ":key": {
          tickets: {
            $get: vi.fn(async () => ({
              ok: true,
              status: 200,
              json: async () => ({ tickets: mockState.tickets }),
              text: async () => "",
            })),
          },
        },
      },
    },
  },
  createClient: () => ({}),
}));

import TicketSearchModal from "./TicketSearchModal.svelte";

const status = makeStatus({ id: "s-1", name: "In Progress", category: "active" });
const member = makeMember({
  userID: "u-1",
  user: { id: "u-1", name: "Alex Member", avatarURL: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
});

const baseProps = {
  open: true,
  title: "Pick a ticket",
  projectKey: "TEST",
  statuses: [status],
  members: [member],
  onpicked: () => {},
  onclose: () => {},
};

describe("TicketSearchModal", () => {
  beforeEach(() => {
    mockState.tickets = [];
  });

  it("renders the title and search input when open", async () => {
    const screen = render(TicketSearchModal, { ...baseProps });
    await expect.element(screen.getByRole("heading", { name: "Pick a ticket" })).toBeVisible();
    await expect.element(screen.getByPlaceholder("Search tickets by title...")).toBeVisible();
  });

  it("shows the type-2-chars hint until enough characters are typed", async () => {
    const screen = render(TicketSearchModal, { ...baseProps });
    await expect.element(screen.getByText("Type at least 2 characters.")).toBeVisible();
  });

  it("renders search results for each matching ticket", async () => {
    mockState.tickets = [
      { id: "t-1", number: 12, title: "First match", statusID: status.id, priority: "high", assigneeID: member.userID },
      { id: "t-2", number: 13, title: "Second match", statusID: status.id, priority: "medium", assigneeID: null },
    ];
    const screen = render(TicketSearchModal, { ...baseProps });
    await screen.getByPlaceholder("Search tickets by title...").fill("match");
    await expect.element(screen.getByText("First match")).toBeVisible();
    await expect.element(screen.getByText("Second match")).toBeVisible();
  });

  it("excludes tickets whose number appears in excludeTicketNumbers", async () => {
    mockState.tickets = [
      { id: "t-1", number: 12, title: "Excluded", statusID: status.id, priority: "medium", assigneeID: null },
      { id: "t-2", number: 13, title: "Included", statusID: status.id, priority: "medium", assigneeID: null },
    ];
    const screen = render(TicketSearchModal, { ...baseProps, excludeTicketNumbers: [12] });
    await screen.getByPlaceholder("Search tickets by title...").fill("incl");
    await expect.element(screen.getByText("Included")).toBeVisible();
    expect(screen.getByText("Excluded").elements()).toHaveLength(0);
  });

  it("calls onpicked with the chosen ticket when a result is clicked", async () => {
    mockState.tickets = [{ id: "t-1", number: 12, title: "Pickable", statusID: status.id, priority: "medium", assigneeID: null }];
    const onpicked = vi.fn();
    const screen = render(TicketSearchModal, { ...baseProps, onpicked });
    await screen.getByPlaceholder("Search tickets by title...").fill("pick");
    await screen.getByRole("button", { name: /TEST-12.*Pickable/ }).click();
    expect(onpicked).toHaveBeenCalledWith({ id: "t-1", number: 12, title: "Pickable" });
  });

  it("renders the primaryAction button in the footer when provided", async () => {
    const run = vi.fn();
    const screen = render(TicketSearchModal, { ...baseProps, primaryAction: { label: "+ Create new", run } });
    await screen.getByRole("button", { name: "+ Create new" }).click();
    expect(run).toHaveBeenCalledOnce();
  });

  it("calls onclose when Cancel is clicked", async () => {
    const onclose = vi.fn();
    const screen = render(TicketSearchModal, { ...baseProps, onclose });
    await screen.getByRole("button", { name: "Cancel" }).click();
    expect(onclose).toHaveBeenCalledOnce();
  });

  it("hides the search input when open is false", async () => {
    const screen = render(TicketSearchModal, { ...baseProps, open: false });
    await expect.element(screen.getByPlaceholder("Search tickets by title...")).not.toBeVisible();
  });
});
