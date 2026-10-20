import { describe, it, expect } from "vitest";
import { makeGlobalActivity } from "$lib/test-utils/fixtures";
import { groupFeed } from "./activityGroups";

const now = new Date(2026, 9, 20, 15, 0);

function at(day: number, hour: number, minute = 0) {
  return new Date(2026, 9, day, hour, minute).toISOString();
}

let counter = 0;
function event(createdAt: string, overrides: Parameters<typeof makeGlobalActivity>[0] = {}) {
  counter += 1;
  return makeGlobalActivity({ id: `event-${counter}`, createdAt, ...overrides });
}

describe("groupFeed", () => {
  it("groups by day with Today and Yesterday headings, and only today starts open", () => {
    const groups = groupFeed([event(at(20, 14)), event(at(20, 9)), event(at(19, 17)), event(at(15, 12))], now);

    expect(groups.map(group => [group.label, group.count, group.open])).toEqual([
      ["Today", 2, true],
      ["Yesterday", 1, false],
      ["Thu 15 Oct", 1, false],
    ]);
  });

  it("puts a change just after midnight in today and one just before in yesterday", () => {
    const groups = groupFeed([event(at(20, 0, 1)), event(at(19, 23, 59))], now);

    expect(groups.map(group => group.label)).toEqual(["Today", "Yesterday"]);
  });

  it("sorts the days newest first even when the feed is out of order", () => {
    const groups = groupFeed([event(at(15, 12)), event(at(20, 9)), event(at(19, 17))], now);

    expect(groups.map(group => group.label)).toEqual(["Today", "Yesterday", "Thu 15 Oct"]);
  });

  it("returns no groups for an empty feed", () => {
    expect(groupFeed([], now)).toEqual([]);
  });

  it("collapses three or more consecutive changes by one person in one project into one line", () => {
    const links = [14, 13, 12, 11, 10, 9].map(hour => event(at(20, hour), { action: "link_added" }));
    const [today] = groupFeed(links, now);

    expect(today.count).toBe(6);
    expect(today.entries).toHaveLength(1);
    expect(today.entries[0]).toMatchObject({ kind: "run", label: "6 link changes in TEST" });
    expect(today.entries[0].kind === "run" && today.entries[0].events).toHaveLength(6);
  });

  it("names a run of mixed changes generically", () => {
    const mixed = [event(at(20, 14), { action: "label_added" }), event(at(20, 13), { action: "link_added" }), event(at(20, 12), { action: "comment_added" })];
    const [today] = groupFeed(mixed, now);

    expect(today.entries[0]).toMatchObject({ kind: "run", label: "3 changes in TEST" });
  });

  it("leaves two changes as separate entries", () => {
    const [today] = groupFeed([event(at(20, 14)), event(at(20, 13))], now);

    expect(today.entries.map(entry => entry.kind)).toEqual(["single", "single"]);
  });

  it("does not join changes that another person or project breaks up", () => {
    const feed = [
      event(at(20, 14), { userID: "u-1" }),
      event(at(20, 13), { userID: "u-1" }),
      event(at(20, 12), { userID: "u-2" }),
      event(at(20, 11), { userID: "u-1" }),
      event(at(20, 10), { userID: "u-1", project: { key: "OTHER", isLocked: false } }),
      event(at(20, 9), { userID: "u-1" }),
    ];
    const [today] = groupFeed(feed, now);

    expect(today.entries.every(entry => entry.kind === "single")).toBe(true);
  });

  it("does not join changes from different days", () => {
    const groups = groupFeed([event(at(20, 9)), event(at(19, 17)), event(at(19, 16))], now);

    expect(groups.flatMap(group => group.entries).every(entry => entry.kind === "single")).toBe(true);
  });
});
