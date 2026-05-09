import { describe, it, expect, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import AssigneePicker from "./AssigneePicker.svelte";
import { makeMember } from "$lib/test-utils/fixtures";

const members = [
  makeMember({
    userID: "u-current",
    role: "owner",
    user: { id: "u-current", name: "Olivia Owner", avatarURL: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  }),
  makeMember({
    userID: "u-alex",
    role: "member",
    user: { id: "u-alex", name: "Alex Member", avatarURL: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  }),
  makeMember({
    userID: "u-blair",
    role: "member",
    user: { id: "u-blair", name: "Blair Other", avatarURL: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  }),
];

describe("AssigneePicker", () => {
  it("renders Unassigned when no value is set", async () => {
    const screen = render(AssigneePicker, { members });
    await expect.element(screen.getByText("Unassigned")).toBeVisible();
  });

  it("renders the assignee name when a value is set", async () => {
    const screen = render(AssigneePicker, { members, value: "u-alex" });
    await expect.element(screen.getByText("Alex Member")).toBeVisible();
  });

  it("opens the menu and lists Unassigned, Assign to me, and other members", async () => {
    const screen = render(AssigneePicker, { members, currentUserID: "u-current" });
    await screen.getByRole("button", { name: /assignee/i }).click();
    await expect.element(screen.getByRole("option", { name: /Unassigned/ })).toBeVisible();
    await expect.element(screen.getByRole("option", { name: /Assign to me/ })).toBeVisible();
    await expect.element(screen.getByRole("option", { name: "Alex Member" })).toBeVisible();
    await expect.element(screen.getByRole("option", { name: "Blair Other" })).toBeVisible();
  });

  it("filters members by the search input", async () => {
    const screen = render(AssigneePicker, { members, currentUserID: "u-current" });
    await screen.getByRole("button", { name: /assignee/i }).click();
    await screen.getByPlaceholder("Search members...").fill("blair");
    await expect.element(screen.getByRole("option", { name: "Blair Other" })).toBeVisible();
    expect(screen.getByRole("option", { name: "Alex Member" }).elements()).toHaveLength(0);
  });

  it("calls onselect with the chosen value and previous value", async () => {
    const onselect = vi.fn();
    const screen = render(AssigneePicker, { members, currentUserID: "u-current", value: undefined, onselect });
    await screen.getByRole("button", { name: /assignee/i }).click();
    await screen.getByRole("option", { name: "Alex Member" }).click();
    expect(onselect).toHaveBeenCalledWith("u-alex", undefined);
  });

  it("renders selected member chips in multi mode", async () => {
    const screen = render(AssigneePicker, { members, multi: true, selected: ["u-alex"] });
    await expect.element(screen.getByLabelText(/1 assignee selected/)).toBeVisible();
  });

  it("calls onChange with the toggled selection in multi mode", async () => {
    const onChange = vi.fn();
    const screen = render(AssigneePicker, { members, multi: true, selected: [], onChange });
    await screen.getByRole("button", { name: /assignee/i }).click();
    await screen.getByRole("option", { name: "Alex Member" }).click();
    expect(onChange).toHaveBeenCalledWith(["u-alex"]);
  });

  it("renders a saving spinner while loading", async () => {
    const screen = render(AssigneePicker, { members, value: "u-alex", loading: true });
    await expect.element(screen.getByLabelText("Saving assignee")).toBeVisible();
  });
});
