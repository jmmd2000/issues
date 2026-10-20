import { describe, it, expect } from "vitest";
import { render } from "vitest-browser-svelte";
import { makeGlobalActivity } from "$lib/test-utils/fixtures";
import ActivityFeed from "./ActivityFeed.svelte";

function recent(overrides: Parameters<typeof makeGlobalActivity>[0]) {
  return makeGlobalActivity({ createdAt: new Date().toISOString(), ...overrides });
}

describe("ActivityFeed", () => {
  it("shows the ticket title for an open project and never for a locked one", async () => {
    const open = recent({ id: "a-1", project: { key: "OPEN", isLocked: false }, ticket: { id: "t-1", number: 1, title: "Visible title" } });
    const locked = recent({ id: "a-2", project: { key: "LOCK", isLocked: true }, ticket: { id: "t-2", number: 2, title: "Secret title" } });
    const screen = await render(ActivityFeed, { props: { events: [open, locked], lookups: {} } });

    await expect.element(screen.getByText("Visible title")).toBeInTheDocument();
    expect(screen.getByText("Secret title").elements()).toHaveLength(0);
  });
});
