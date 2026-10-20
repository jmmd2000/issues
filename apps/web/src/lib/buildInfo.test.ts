import { describe, it, expect } from "vitest";
import { commitsDiffer, formatBuiltAt, shortHash } from "./buildInfo";

describe("shortHash", () => {
  it("shortens a full commit hash to seven characters", () => {
    expect(shortHash("abc1234def5678abc1234def5678abc1234def56")).toBe("abc1234");
  });

  it("leaves dev as it is", () => {
    expect(shortHash("dev")).toBe("dev");
  });
});

describe("commitsDiffer", () => {
  it("does not warn when a local run shows dev on both sides", () => {
    expect(commitsDiffer("dev", "dev")).toBe(false);
  });

  it("does not warn when one side has the full hash and the other the short hash", () => {
    expect(commitsDiffer("abc1234def5678", "abc1234")).toBe(false);
  });

  it("warns when the commits differ", () => {
    expect(commitsDiffer("abc1234", "def5678")).toBe(true);
  });

  it("warns when only one side is a dev build", () => {
    expect(commitsDiffer("dev", "abc1234")).toBe(true);
  });
});

describe("formatBuiltAt", () => {
  it("says the time is not recorded for a local run", () => {
    expect(formatBuiltAt(null)).toBe("Not recorded");
  });

  it("shows text that is not a date as it is", () => {
    expect(formatBuiltAt("not a date")).toBe("not a date");
  });

  it("formats a build time", () => {
    expect(formatBuiltAt("2026-10-20T09:30:00Z")).toMatch(/2026/);
  });
});
