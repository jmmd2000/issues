import { describe, it, expect } from "vitest";
import { render } from "vitest-browser-svelte";
import { makeLabel, makeStatus } from "$lib/test-utils/fixtures";
import ReadOnlyLabels from "./ReadOnlyLabels.svelte";
import ReadOnlyStatuses from "./ReadOnlyStatuses.svelte";

describe("ReadOnlyLabels", () => {
  it("lists every label and says only the owner can change them", async () => {
    const labels = [makeLabel({ id: "l1", name: "Bug" }), makeLabel({ id: "l2", name: "Feature" })];
    const screen = await render(ReadOnlyLabels, { labels });

    await expect.element(screen.getByText("Only the project owner can change labels.")).toBeVisible();
    await expect.element(screen.getByText("Bug")).toBeVisible();
    await expect.element(screen.getByText("Feature")).toBeVisible();
  });

  it("says so when the project has no labels", async () => {
    const screen = await render(ReadOnlyLabels, { labels: [] });

    await expect.element(screen.getByText("This project has no labels.")).toBeVisible();
  });
});

describe("ReadOnlyStatuses", () => {
  it("says only the owner can change statuses", async () => {
    const screen = await render(ReadOnlyStatuses, { statuses: [makeStatus({ id: "s1", name: "Backlog" })] });

    await expect.element(screen.getByText("Only the project owner can change statuses.")).toBeVisible();
  });

  it("orders statuses by category, then by position", async () => {
    const statuses = [
      makeStatus({ id: "s1", name: "Done", category: "done", position: 10 }),
      makeStatus({ id: "s2", name: "In Review", category: "active", position: 20 }),
      makeStatus({ id: "s3", name: "Backlog", category: "backlog", position: 10 }),
      makeStatus({ id: "s4", name: "In Progress", category: "active", position: 10 }),
      makeStatus({ id: "s5", name: "Cancelled", category: "cancelled", position: 10 }),
    ];
    const screen = await render(ReadOnlyStatuses, { statuses });

    const names = screen
      .getByRole("listitem")
      .elements()
      .map(item => item.textContent);
    expect(names).toEqual(["Backlog", "In Progress", "In Review", "Done", "Cancelled"]);
  });
});
