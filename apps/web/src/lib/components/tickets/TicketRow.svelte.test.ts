import { describe, it, expect } from "vitest";
import { render } from "vitest-browser-svelte";
import TicketRow from "./TicketRow.svelte";

const baseProps = {
  ticket: { id: "t-1", number: 12, title: "Wire up the modal", projectKey: "TEST" },
  status: { name: "In Progress", category: "active" as const },
};

describe("TicketRow", () => {
  it("links to the ticket detail page", async () => {
    const screen = await render(TicketRow, { ...baseProps });
    const link = screen.getByRole("link");
    await expect.element(link).toHaveAttribute("href", "/projects/TEST/tickets/12");
  });
});
