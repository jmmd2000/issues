import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { findVisibleTicketRefs } from "$lib/api/ticketRefs";
import MarkdownRenderer from "./MarkdownRenderer.svelte";

vi.mock("$lib/api/ticketRefs", () => ({ findVisibleTicketRefs: vi.fn() }));

const lookup = vi.mocked(findVisibleTicketRefs);

describe("MarkdownRenderer ticket refs", () => {
  beforeEach(() => {
    lookup.mockReset();
  });

  it("links a ref that exists and leaves a ref that does not as plain text", async () => {
    lookup.mockResolvedValue(new Set(["DASH-12"]));
    const screen = await render(MarkdownRenderer, { source: "See DASH-12 and UTF-8 for details." });

    await expect.element(screen.getByRole("link", { name: "DASH-12" })).toHaveAttribute("href", "/projects/DASH/tickets/12");
    expect(screen.container.querySelectorAll("a")).toHaveLength(1);
    expect(screen.container.textContent).toContain("See DASH-12 and UTF-8 for details.");
    expect(lookup).toHaveBeenCalledWith(["DASH-12", "UTF-8"]);
  });

  it("links nothing when the lookup finds no refs", async () => {
    lookup.mockResolvedValue(new Set());
    const screen = await render(MarkdownRenderer, { source: "See DASH-12." });

    await expect.poll(() => lookup.mock.calls.length).toBe(1);
    await new Promise(resolve => setTimeout(resolve));
    expect(screen.container.querySelectorAll("a")).toHaveLength(0);
    expect(screen.container.textContent).toContain("See DASH-12.");
  });

  it("skips the lookup when the text has no refs, or only has them in code", async () => {
    await render(MarkdownRenderer, { source: "No refs here, and `DASH-12` is code." });

    expect(lookup).not.toHaveBeenCalled();
  });
});
