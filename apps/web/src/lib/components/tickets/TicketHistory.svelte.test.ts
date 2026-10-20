import { describe, it, expect } from "vitest";
import { render } from "vitest-browser-svelte";
import TicketHistory from "./TicketHistory.svelte";
import { makeActivity, makeComment, makeMember, makeStatus } from "$lib/test-utils/fixtures";

const baseProps = {
  comments: [],
  activity: [],
  statuses: [makeStatus()],
  labels: [],
  members: [makeMember()],
  projectKey: "TEST",
  ticketNumber: 42,
  currentUserID: "00000000-0000-0000-0000-0000000000u1",
  onmutated: () => Promise.resolve(),
};

describe("TicketHistory", () => {
  it("switches to the Activity tab and shows the empty activity state", async () => {
    const screen = await render(TicketHistory, { ...baseProps });
    await screen.getByRole("tab", { name: "Activity" }).click();
    await expect.element(screen.getByText("No activity yet.")).toBeVisible();
  });

  it("expands the comment body inline for comment_added rows on the All tab", async () => {
    const comment = makeComment({ id: "c-1", body: "First post" });
    const activity = [makeActivity({ id: "a-1", action: "comment_added", newValue: { id: "c-1", excerpt: "First post" } })];
    const screen = await render(TicketHistory, { ...baseProps, comments: [comment], activity });
    await screen.getByRole("tab", { name: "All" }).click();
    await expect.element(screen.getByText("First post")).toBeVisible();
  });
});
