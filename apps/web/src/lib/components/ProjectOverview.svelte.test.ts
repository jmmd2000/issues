import { describe, it, expect } from "vitest";
import { render } from "vitest-browser-svelte";
import type { ComponentProps } from "svelte";
import ProjectOverview from "./ProjectOverview.svelte";
import { makeProjectActivity, makeProjectDetail, makeProjectStats } from "$lib/test-utils/fixtures";

function renderOverview(overrides: Partial<ComponentProps<typeof ProjectOverview>> = {}) {
  const project = overrides.project ?? makeProjectDetail();
  return render(ProjectOverview, {
    project,
    stats: makeProjectStats(),
    activity: [],
    statuses: project.statuses,
    labels: project.labels,
    members: project.members,
    ...overrides,
  });
}

describe("ProjectOverview", () => {
  it("renders the owner, visibility and repo metadata", async () => {
    const screen = renderOverview({
      project: makeProjectDetail({ visibility: "public", repo: "https://github.com/example/repo" }),
    });
    await expect.element(screen.getByText("Olivia Owner")).toBeVisible();
    await expect.element(screen.getByText("public")).toBeVisible();
    await expect.element(screen.getByRole("link", { name: /github\.com\/example\/repo/ })).toBeVisible();
  });

  it("renders Not linked when the project has no repo", async () => {
    const screen = renderOverview({ project: makeProjectDetail({ repo: null }) });
    await expect.element(screen.getByText("Not linked")).toBeVisible();
  });

  it("renders the ticket counts from stats", async () => {
    const screen = renderOverview({ stats: makeProjectStats({ totalTickets: 12, openTickets: 7, closedTickets: 5 }) });
    await expect.element(screen.getByText("12")).toBeVisible();
    await expect.element(screen.getByText("7")).toBeVisible();
    await expect.element(screen.getByText("5")).toBeVisible();
  });

  it("renders the empty state when there is no activity", async () => {
    const screen = renderOverview();
    await expect.element(screen.getByText("No activity yet.")).toBeVisible();
  });

  it("renders an activity row when activity is present", async () => {
    const project = makeProjectDetail();
    const activity = [
      makeProjectActivity({
        id: "a-1",
        action: "created",
        newValue: { value: "First ticket" },
        ticket: { id: "t-1", number: 1, title: "First ticket" },
        user: { id: project.members[0].userID, name: project.members[0].user.name, avatarURL: null },
      }),
    ];
    const screen = renderOverview({
      project,
      activity,
      stats: makeProjectStats({ totalTickets: 1, openTickets: 1 }),
    });
    expect(screen.getByText("No activity yet.").elements()).toHaveLength(0);
    await expect.element(screen.getByText(/TEST-1/)).toBeVisible();
  });
});
