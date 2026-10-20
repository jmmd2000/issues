import { describe, it, expect } from "vitest";
import { daysLeft, expiryLabel } from "./tokens";

const now = new Date("2026-10-20T12:00:00.000Z");

describe("daysLeft", () => {
  it("counts a part day as a full day", () => {
    expect(daysLeft("2026-10-21T00:00:00.000Z", now)).toBe(1);
    expect(daysLeft("2026-10-27T11:00:00.000Z", now)).toBe(7);
  });

  it("is zero at the moment of expiry and negative after it", () => {
    expect(daysLeft("2026-10-20T12:00:00.000Z", now)).toBe(0);
    expect(daysLeft("2026-10-18T12:00:00.000Z", now)).toBe(-2);
  });
});

describe("expiryLabel", () => {
  it("shows days left for a token with plenty of time", () => {
    expect(expiryLabel(78)).toEqual({ text: "78 days left", tone: "ok" });
    expect(expiryLabel(15)).toEqual({ text: "15 days left", tone: "ok" });
  });

  it("warns from 14 days, and says day for one day", () => {
    expect(expiryLabel(14)).toEqual({ text: "Expires in 14 days", tone: "soon" });
    expect(expiryLabel(1)).toEqual({ text: "Expires in 1 day", tone: "soon" });
  });

  it("says Expired once there is no time left", () => {
    expect(expiryLabel(0)).toEqual({ text: "Expired", tone: "expired" });
    expect(expiryLabel(-3)).toEqual({ text: "Expired", tone: "expired" });
  });
});
