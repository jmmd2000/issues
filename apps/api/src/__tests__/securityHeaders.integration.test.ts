import { describe, it, expect } from "vitest";
import app from "../index";

function expectSecurityHeaders(res: Response) {
  expect(res.headers.get("content-security-policy")).toBe("default-src 'none'; frame-ancestors 'none'");
  expect(res.headers.get("x-frame-options")).toBe("DENY");
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
  expect(res.headers.get("strict-transport-security")).toContain("max-age=");
  expect(res.headers.get("cross-origin-resource-policy")).toBe("same-site");
}

describe("API security headers", () => {
  it("are sent on a JSON response", async () => {
    const res = await app.request("/api/health");

    expect(res.status).toBe(200);
    expectSecurityHeaders(res);
  });

  it("are sent on an error response from the uploads route", async () => {
    const res = await app.request("/uploads/not-a-key");

    expect(res.status).toBe(400);
    expectSecurityHeaders(res);
  });
});
