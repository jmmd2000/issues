import { describe, it, expect } from "vitest";
import { isShowingDark, parseThemeChoice, readStoredTheme, storeTheme, THEME_STORAGE_KEY } from "./theme";

const blockedStorage = {
  getItem: () => {
    throw new Error("Storage is blocked");
  },
  setItem: () => {
    throw new Error("Storage is blocked");
  },
};

describe("parseThemeChoice", () => {
  it("accepts light and dark", () => {
    expect(parseThemeChoice("light")).toBe("light");
    expect(parseThemeChoice("dark")).toBe("dark");
  });

  it("treats system, a missing value and anything unknown as system", () => {
    expect(parseThemeChoice("system")).toBe("system");
    expect(parseThemeChoice(null)).toBe("system");
    expect(parseThemeChoice("solarized")).toBe("system");
    expect(parseThemeChoice(42)).toBe("system");
  });
});

describe("readStoredTheme", () => {
  it("reads the saved choice", () => {
    expect(readStoredTheme({ getItem: key => (key === THEME_STORAGE_KEY ? "dark" : null) })).toBe("dark");
  });

  it("falls back to system when nothing is saved", () => {
    expect(readStoredTheme({ getItem: () => null })).toBe("system");
  });

  it("falls back to system when storage is blocked", () => {
    expect(readStoredTheme(blockedStorage)).toBe("system");
  });
});

describe("isShowingDark", () => {
  it("follows a theme set on the page, whatever the browser prefers", () => {
    expect(isShowingDark({ dataset: { theme: "dark" } }, () => false)).toBe(true);
    expect(isShowingDark({ dataset: { theme: "light" } }, () => true)).toBe(false);
  });

  it("follows the browser setting when no theme is set", () => {
    expect(isShowingDark({ dataset: {} }, () => true)).toBe(true);
    expect(isShowingDark({ dataset: {} }, () => false)).toBe(false);
  });
});

describe("storeTheme", () => {
  it("saves the choice under the shared key", () => {
    const saved: Record<string, string> = {};
    storeTheme("light", { setItem: (key, value) => (saved[key] = value) });

    expect(saved).toEqual({ [THEME_STORAGE_KEY]: "light" });
  });

  it("does not throw when storage is blocked", () => {
    expect(() => storeTheme("dark", blockedStorage)).not.toThrow();
  });
});
