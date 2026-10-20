import { describe, it, expect } from "vitest";
import { formatActivity } from "./activity";
import { makeActivity } from "$lib/test-utils/fixtures";

describe("formatActivity", () => {
  it("names the new title when a ticket is renamed", () => {
    const row = makeActivity({ action: "updated", fieldName: "title", oldValue: { value: "Old" }, newValue: { value: "New" } });
    expect(formatActivity(row)).toBe('renamed to "New"');
  });

  it("falls back to a general sentence when an update has no field name", () => {
    const row = makeActivity({ action: "updated", fieldName: null });
    expect(formatActivity(row)).toBe("updated this ticket");
  });

  it("shows both sides of a status change, or only the new status when there is no old one", () => {
    const changed = makeActivity({ action: "updated", fieldName: "statusID", oldValue: { id: "s1", name: "Backlog" }, newValue: { id: "s2", name: "Done" } });
    const created = makeActivity({ action: "updated", fieldName: "statusID", oldValue: null, newValue: { id: "s2", name: "Done" } });
    expect(formatActivity(changed)).toBe("changed status from Backlog to Done");
    expect(formatActivity(created)).toBe("set status to Done");
  });

  it("describes assigning, reassigning and unassigning", () => {
    const assigned = makeActivity({ action: "updated", fieldName: "assigneeID", oldValue: null, newValue: { id: "u1", name: "Alex" } });
    const reassigned = makeActivity({ action: "updated", fieldName: "assigneeID", oldValue: { id: "u1", name: "Alex" }, newValue: { id: "u2", name: "Blair" } });
    const unassigned = makeActivity({ action: "updated", fieldName: "assigneeID", oldValue: { id: "u1", name: "Alex" }, newValue: null });
    expect(formatActivity(assigned)).toBe("assigned Alex");
    expect(formatActivity(reassigned)).toBe("reassigned from Alex to Blair");
    expect(formatActivity(unassigned)).toBe("unassigned Alex");
  });

  it("describes setting, changing and removing a parent", () => {
    const set = makeActivity({ action: "updated", fieldName: "parentID", oldValue: null, newValue: { id: "t1", name: "TEST-1" } });
    const changed = makeActivity({ action: "updated", fieldName: "parentID", oldValue: { id: "t1", name: "TEST-1" }, newValue: { id: "t2", name: "TEST-2" } });
    const removed = makeActivity({ action: "updated", fieldName: "parentID", oldValue: { id: "t1", name: "TEST-1" }, newValue: null });
    expect(formatActivity(set)).toBe("set parent to TEST-1");
    expect(formatActivity(changed)).toBe("changed parent from TEST-1 to TEST-2");
    expect(formatActivity(removed)).toBe("removed parent ticket");
  });

  it("strips the ID suffix from fields it has no special wording for", () => {
    const row = makeActivity({ action: "updated", fieldName: "milestoneID" });
    expect(formatActivity(row)).toBe("updated milestone");
  });

  it("uses the ticket reference for a clone when the source has a project key and number", () => {
    const row = makeActivity({ action: "cloned_from", newValue: { projectKey: "TEST", number: 4, title: "Source" } });
    expect(formatActivity(row)).toBe("cloned from TEST-4");
  });

  it("turns a link type into words and falls back to the ticket number", () => {
    const row = makeActivity({ action: "link_added", fieldName: "depends_on", newValue: { number: 7 } });
    expect(formatActivity(row)).toBe("added link: depends on #7");
  });
});
