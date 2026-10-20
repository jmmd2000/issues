import { describe, it, expect } from "vitest";
import { canChangePassword, checkNewPassword } from "./passwordRules";

describe("checkNewPassword", () => {
  it("needs at least eight characters", () => {
    expect(checkNewPassword("1234567", "1234567").longEnough).toBe(false);
    expect(checkNewPassword("12345678", "12345678").longEnough).toBe(true);
  });

  it("matches only when both fields are the same and not empty", () => {
    expect(checkNewPassword("", "").matches).toBe(false);
    expect(checkNewPassword("password1", "password2").matches).toBe(false);
    expect(checkNewPassword("password1", "password1").matches).toBe(true);
  });
});

describe("canChangePassword", () => {
  it("needs the current password as well as a valid new one", () => {
    expect(canChangePassword("", "password1", "password1")).toBe(false);
    expect(canChangePassword("old", "short", "short")).toBe(false);
    expect(canChangePassword("old", "password1", "different1")).toBe(false);
    expect(canChangePassword("old", "password1", "password1")).toBe(true);
  });
});
