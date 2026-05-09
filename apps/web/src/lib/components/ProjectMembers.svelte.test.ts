import { describe, it, expect } from "vitest";
import { render } from "vitest-browser-svelte";
import ProjectMembers from "./ProjectMembers.svelte";
import { makeMember, makeProjectStats } from "$lib/test-utils/fixtures";

const owner = makeMember({
  userID: "u-owner",
  role: "owner",
  user: { id: "u-owner", name: "Olivia Owner", avatarURL: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
});

const member = makeMember({
  userID: "u-alex",
  role: "member",
  user: { id: "u-alex", name: "Alex Member", avatarURL: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
});

describe("ProjectMembers", () => {
  it("renders one row per member under the Members heading", async () => {
    const screen = render(ProjectMembers, { members: [owner, member], stats: makeProjectStats() });
    await expect.element(screen.getByRole("heading", { name: "Members" })).toBeVisible();
    expect(screen.getByRole("listitem").elements()).toHaveLength(2);
  });

  it("renders each member's name and role badge", async () => {
    const screen = render(ProjectMembers, { members: [owner, member], stats: makeProjectStats() });
    await expect.element(screen.getByText("Olivia Owner")).toBeVisible();
    await expect.element(screen.getByText("Alex Member")).toBeVisible();
    const rows = screen.getByRole("listitem");
    await expect.element(rows.nth(0).getByText("owner")).toBeVisible();
    await expect.element(rows.nth(1).getByText("member", { exact: true })).toBeVisible();
  });

  it("renders zero stats for members not present in stats.byMember", async () => {
    const screen = render(ProjectMembers, { members: [member], stats: makeProjectStats() });
    const row = screen.getByRole("listitem").first();
    await expect.element(row.getByText("Assigned · open")).toBeVisible();
    await expect.element(row.getByText("Assigned · all")).toBeVisible();
    await expect.element(row.getByText("Reported")).toBeVisible();
    expect(row.getByText("0", { exact: true }).elements()).toHaveLength(3);
  });

  it("renders the assigned/reported counts when stats are populated", async () => {
    const stats = makeProjectStats({
      byMember: {
        [member.userID]: { assignedOpen: 4, assignedTotal: 9, reported: 12 },
      },
    });
    const screen = render(ProjectMembers, { members: [member], stats });
    const row = screen.getByRole("listitem").first();
    await expect.element(row.getByText("4")).toBeVisible();
    await expect.element(row.getByText("9")).toBeVisible();
    await expect.element(row.getByText("12")).toBeVisible();
  });

  it("places the owner first regardless of input order", async () => {
    const screen = render(ProjectMembers, { members: [member, owner], stats: makeProjectStats() });
    await expect.element(screen.getByRole("listitem").first().getByText("Olivia Owner")).toBeVisible();
  });
});
