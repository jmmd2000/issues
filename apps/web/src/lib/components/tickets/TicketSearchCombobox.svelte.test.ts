import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "vitest-browser-svelte";

const mockState = vi.hoisted(() => ({
  lastQuery: null as Record<string, unknown> | null,
  tickets: [] as Array<{ id: string; number: number; title: string }>,
}));

vi.mock("$lib/api/client", () => ({
  client: {
    api: {
      projects: {
        ":key": {
          tickets: {
            $get: vi.fn(async (req: { param: { key: string }; query: Record<string, unknown> }) => {
              mockState.lastQuery = req.query;
              return {
                ok: true,
                status: 200,
                json: async () => ({ tickets: mockState.tickets }),
                text: async () => "",
              };
            }),
          },
        },
      },
    },
  },
  createClient: () => ({}),
}));

import TicketSearchCombobox, { type TicketRef } from "./TicketSearchCombobox.svelte";

const baseProps = {
  projectKey: "TEST",
  onpicked: () => {},
};

describe("TicketSearchCombobox", () => {
  beforeEach(() => {
    mockState.lastQuery = null;
    mockState.tickets = [];
  });

  it("renders the search input when no ticket is selected", async () => {
    const screen = render(TicketSearchCombobox, { ...baseProps });
    await expect.element(screen.getByPlaceholder("Search tickets by title...")).toBeVisible();
  });

  it("does not query the API for terms shorter than 2 characters", async () => {
    const screen = render(TicketSearchCombobox, { ...baseProps });
    await screen.getByPlaceholder("Search tickets by title...").fill("a");
    expect(mockState.lastQuery).toBeNull();
  });

  it("renders matching results after the debounce window", async () => {
    mockState.tickets = [
      { id: "t-1", number: 1, title: "First ticket" },
      { id: "t-2", number: 2, title: "Second ticket" },
    ];
    const screen = render(TicketSearchCombobox, { ...baseProps });
    await screen.getByPlaceholder("Search tickets by title...").fill("ticket");
    await expect.element(screen.getByRole("button", { name: /TEST-1.*First ticket/ })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: /TEST-2.*Second ticket/ })).toBeVisible();
  });

  it("renders the no-matches hint when the API returns an empty list", async () => {
    mockState.tickets = [];
    const screen = render(TicketSearchCombobox, { ...baseProps });
    await screen.getByPlaceholder("Search tickets by title...").fill("none");
    await expect.element(screen.getByText("No matches.")).toBeVisible();
  });

  it("calls onpicked with the chosen ticket and clears the dropdown", async () => {
    mockState.tickets = [{ id: "t-1", number: 1, title: "First ticket" }];
    const onpicked = vi.fn();
    const screen = render(TicketSearchCombobox, { ...baseProps, onpicked });
    await screen.getByPlaceholder("Search tickets by title...").fill("first");
    await screen.getByRole("button", { name: /TEST-1.*First ticket/ }).click();
    expect(onpicked).toHaveBeenCalledWith({ id: "t-1", number: 1, title: "First ticket" });
  });

  it("excludes the given ticket number from the results", async () => {
    mockState.tickets = [
      { id: "t-1", number: 1, title: "Self ticket" },
      { id: "t-2", number: 2, title: "Other ticket" },
    ];
    const screen = render(TicketSearchCombobox, { ...baseProps, excludeTicketNumber: 1 });
    await screen.getByPlaceholder("Search tickets by title...").fill("ticket");
    await expect.element(screen.getByRole("button", { name: /TEST-2.*Other ticket/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /TEST-1/ }).elements()).toHaveLength(0);
  });

  it("forwards includeClosed to the API query", async () => {
    mockState.tickets = [{ id: "t-1", number: 1, title: "Closed ticket" }];
    const screen = render(TicketSearchCombobox, { ...baseProps, includeClosed: true });
    await screen.getByPlaceholder("Search tickets by title...").fill("closed");
    await expect.element(screen.getByRole("button", { name: /TEST-1/ })).toBeVisible();
    expect(mockState.lastQuery).toMatchObject({ includeClosed: "true" });
  });

  it("renders the default selection pill when a ticket is selected", async () => {
    const selected: TicketRef = { id: "t-7", number: 7, title: "Picked ticket" };
    const screen = render(TicketSearchCombobox, { ...baseProps, selected });
    await expect.element(screen.getByText("TEST-7")).toBeVisible();
    await expect.element(screen.getByText("Picked ticket")).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Clear selected ticket" })).toBeVisible();
  });

  it("calls oncleared when the pill clear button is clicked", async () => {
    const selected: TicketRef = { id: "t-7", number: 7, title: "Picked ticket" };
    const oncleared = vi.fn();
    const screen = render(TicketSearchCombobox, { ...baseProps, selected, oncleared });
    await screen.getByRole("button", { name: "Clear selected ticket" }).click();
    expect(oncleared).toHaveBeenCalledOnce();
  });

  it("disables the input when the disabled prop is set", async () => {
    const screen = render(TicketSearchCombobox, { ...baseProps, disabled: true });
    await expect.element(screen.getByPlaceholder("Search tickets by title...")).toBeDisabled();
  });

  it("disables the pill clear button when the disabled prop is set", async () => {
    const selected: TicketRef = { id: "t-7", number: 7, title: "Picked ticket" };
    const screen = render(TicketSearchCombobox, { ...baseProps, selected, disabled: true });
    await expect.element(screen.getByRole("button", { name: "Clear selected ticket" })).toBeDisabled();
  });
});
