import { describe, it, expect } from "vitest";
import { isValidKey, normaliseKey, suggestKey } from "./projectKey";

describe("suggestKey", () => {
  it("uses the first four letters of a single word", () => {
    expect(suggestKey("Dashboard")).toBe("DASH");
    expect(suggestKey("API")).toBe("API");
  });

  it("uses the initials of several words, up to four", () => {
    expect(suggestKey("Personal website")).toBe("PW");
    expect(suggestKey("Album review library of music")).toBe("ARLO");
  });

  it("skips punctuation and extra spaces", () => {
    expect(suggestKey("  my - cool   app!  ")).toBe("MCA");
    expect(suggestKey("C++ tools")).toBe("CT");
  });

  it("gives an empty key for a blank or symbol-only name", () => {
    expect(suggestKey("")).toBe("");
    expect(suggestKey("   ")).toBe("");
    expect(suggestKey("!!! ???")).toBe("");
  });
});

describe("normaliseKey", () => {
  it("uppercases, drops anything but letters and numbers, and stops at six characters", () => {
    expect(normaliseKey("web-2!")).toBe("WEB2");
    expect(normaliseKey("abcdefghi")).toBe("ABCDEF");
  });
});

describe("isValidKey", () => {
  it("needs two to six capital letters or numbers", () => {
    expect(isValidKey("A")).toBe(false);
    expect(isValidKey("AB")).toBe(true);
    expect(isValidKey("A1B2C3")).toBe(true);
    expect(isValidKey("ABCDEFG")).toBe(false);
    expect(isValidKey("A B")).toBe(false);
    expect(isValidKey("ab")).toBe(false);
  });
});
