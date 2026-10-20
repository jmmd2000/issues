import { describe, it, expect } from "vitest";
import { render } from "vitest-browser-svelte";
import "../../../app.css";
import { makeMember } from "$lib/test-utils/fixtures";
import { contrastRatio } from "$lib/test-utils/contrast";
import TicketCard from "./TicketCard.svelte";

const ticket = {
  id: "t-1",
  number: 7,
  title: "Review pagination controls",
  priority: "none",
  assigneeID: null,
  updatedAt: "2026-10-20T10:00:00.000Z",
} as unknown as Parameters<typeof TicketCard>[1]["ticket"];

describe("TicketCard", () => {
  for (const category of ["done", "cancelled"] as const) {
    for (const scheme of ["light", "dark"]) {
      it(`does not cross out a ${category} title and keeps it at 4.5:1 or more in ${scheme} mode`, async () => {
        document.documentElement.style.colorScheme = scheme;
        try {
          const screen = await render(TicketCard, { projectKey: "TEST", ticket, members: [makeMember()], category });
          const card = screen.getByRole("link").element();
          const title = getComputedStyle(screen.getByRole("heading").element());

          expect(title.textDecorationLine).toBe("none");
          expect(title.backgroundImage).toBe("none");
          expect(contrastRatio(title.color, getComputedStyle(card).backgroundColor)).toBeGreaterThanOrEqual(4.5);
        } finally {
          document.documentElement.style.colorScheme = "";
        }
      });
    }
  }
});
