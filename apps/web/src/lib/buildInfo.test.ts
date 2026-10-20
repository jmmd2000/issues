import { describe, it, expect } from "vitest";
import { apiBuildRows, buildDetailsText, buildStatement, commitsDiffer, formatBuiltAt, shortHash } from "./buildInfo";

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

describe("buildStatement", () => {
  const web = { siteVersion: "1.0.0", gitSha: "abc1234def", builtAt: null, packages: [] };
  const api = { gitSha: "abc1234", builtAt: null, nodeVersion: "26.0.0", postgresVersion: null, packages: [] };

  it("says the builds match when the commits are the same", () => {
    expect(buildStatement(web, api)).toEqual({ type: "success", text: "The web app and the API were built from the same commit." });
  });

  it("flags different commits", () => {
    expect(buildStatement(web, { ...api, gitSha: "def5678" }).type).toBe("error");
  });

  it("says so when the API build could not be loaded", () => {
    expect(buildStatement(web, null)).toEqual({ type: "error", text: "The API build could not be loaded. Only the web build is shown." });
  });
});

describe("buildDetailsText", () => {
  it("lists the site version and each build, skipping the API when it is missing", () => {
    const web = [{ label: "Commit", value: "abc1234" }];
    const api = [{ label: "Commit", value: "abc1234" }];

    expect(buildDetailsText("1.0.0", web, api)).toBe("Site version: 1.0.0\n\nWeb\n  Commit: abc1234\n\nAPI\n  Commit: abc1234");
    expect(buildDetailsText("1.0.0", web, null)).toBe("Site version: 1.0.0\n\nWeb\n  Commit: abc1234");
  });
});

describe("apiBuildRows", () => {
  it("shows Unknown for a Postgres or package version the API could not report", () => {
    const rows = apiBuildRows({ gitSha: "abc1234", builtAt: null, nodeVersion: "26.0.0", postgresVersion: null, packages: [{ name: "hono", version: null }] });

    expect(rows).toContainEqual({ label: "Postgres", value: "Unknown" });
    expect(rows).toContainEqual({ label: "hono", value: "Unknown" });
  });
});
