import { describe, it, expect, beforeEach, afterEach } from "vitest";
import app from "../index";
import { createAuthenticatedUser, resetDatabase } from "./helpers";

let cookies: string;

describe("GET /api/build", () => {
  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
  });

  afterEach(() => {
    delete process.env.GIT_SHA;
    delete process.env.BUILT_AT;
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await app.request("/api/build");

    expect(res.status).toBe(401);
  });

  it("reports dev and no build time when the environment sets neither", async () => {
    const res = await app.request("/api/build", { headers: { Cookie: cookies } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.build.gitSha).toBe("dev");
    expect(body.build.builtAt).toBeNull();
  });

  it("reports the commit and build time from the environment", async () => {
    process.env.GIT_SHA = "abc1234";
    process.env.BUILT_AT = "2026-10-20T09:00:00Z";

    const res = await app.request("/api/build", { headers: { Cookie: cookies } });
    const body = await res.json();

    expect(body.build.gitSha).toBe("abc1234");
    expect(body.build.builtAt).toBe("2026-10-20T09:00:00Z");
  });

  it("reports the running Node and Postgres versions and the main package versions", async () => {
    const res = await app.request("/api/build", { headers: { Cookie: cookies } });
    const body = await res.json();

    expect(body.build.nodeVersion).toBe(process.versions.node);
    expect(body.build.postgresVersion).toMatch(/^\d+(\.\d+)*$/);
    expect(body.build.packages.map((item: { name: string }) => item.name)).toEqual(["hono", "drizzle-orm", "pg", "zod"]);
    for (const item of body.build.packages) {
      expect(item.version).toMatch(/^\d+\.\d+\.\d+/);
    }
  });
});
