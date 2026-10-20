import { describe, it, expect } from "vitest";
import { getInstalledVersion } from "../lib/installedVersion";

describe("getInstalledVersion", () => {
  it("finds the version of a package that does not export its package.json", () => {
    expect(getInstalledVersion("hono")).toMatch(/^\d+\.\d+\.\d+/);
    expect(getInstalledVersion("drizzle-orm")).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("returns null for a package that is not installed", () => {
    expect(getInstalledVersion("not-a-real-package-name")).toBeNull();
  });
});
