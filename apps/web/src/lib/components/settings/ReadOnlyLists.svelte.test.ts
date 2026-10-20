import { describe, it, expect } from "vitest";
import { render } from "vitest-browser-svelte";
import { makeStatus } from "$lib/test-utils/fixtures";
import ReadOnlyStatuses from "./ReadOnlyStatuses.svelte";

describe("ReadOnlyStatuses", () => {
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
