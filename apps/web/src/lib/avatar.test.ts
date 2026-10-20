import { describe, it, expect } from "vitest";
import { isAvatarType } from "./avatar";

describe("isAvatarType", () => {
  it("accepts PNG, JPEG and WebP", () => {
    expect(["image/png", "image/jpeg", "image/webp"].every(isAvatarType)).toBe(true);
  });

  it("refuses other images and other files", () => {
    expect(isAvatarType("image/gif")).toBe(false);
    expect(isAvatarType("image/svg+xml")).toBe(false);
    expect(isAvatarType("application/pdf")).toBe(false);
    expect(isAvatarType("")).toBe(false);
  });
});
