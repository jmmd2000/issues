import { describe, it, expect } from "vitest";
import { render } from "vitest-browser-svelte";
import { createRawSnippet } from "svelte";
import TicketRow from "./TicketRow.svelte";

const baseProps = {
  ticket: { id: "t-1", number: 12, title: "Wire up the modal", projectKey: "TEST" },
  status: { name: "In Progress", category: "active" as const },
};

describe("TicketRow", () => {
  it("renders the key, title, and status chip", async () => {
    const screen = render(TicketRow, { ...baseProps });
    await expect.element(screen.getByText("TEST-12")).toBeVisible();
    await expect.element(screen.getByText("Wire up the modal")).toBeVisible();
    await expect.element(screen.getByText("In Progress")).toBeVisible();
  });

  it("links to the ticket detail page", async () => {
    const screen = render(TicketRow, { ...baseProps });
    const link = screen.getByRole("link");
    await expect.element(link).toHaveAttribute("href", "/projects/TEST/tickets/12");
  });

  it("renders a priority chip when priority is provided", async () => {
    const screen = render(TicketRow, { ...baseProps, priority: "high" });
    await expect.element(screen.getByLabelText("High priority")).toBeVisible();
  });

  it("does not render a priority chip when priority is omitted", async () => {
    const screen = render(TicketRow, { ...baseProps });
    expect(screen.getByLabelText(/priority/).elements()).toHaveLength(0);
  });

  it("renders the assignee avatar when an assignee is provided", async () => {
    const screen = render(TicketRow, { ...baseProps, assignee: { name: "Alex Member", avatarURL: null } });
    await expect.element(screen.getByLabelText("Alex Member")).toBeVisible();
  });

  it("renders the trailing snippet content", async () => {
    const trailing = createRawSnippet(() => ({
      render: () => `<button type="button" data-testid="custom-action">Custom</button>`,
    }));
    const screen = render(TicketRow, { ...baseProps, trailing });
    await expect.element(screen.getByTestId("custom-action")).toBeVisible();
  });
});
