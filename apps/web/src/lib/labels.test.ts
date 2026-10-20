import { describe, it, expect } from "vitest";
import { deleteLabelWarning, parseHexColour } from "./labels";

describe("parseHexColour", () => {
  it("accepts six digits with or without the hash, in any case", () => {
    expect(parseHexColour("#E11D48")).toBe("#e11d48");
    expect(parseHexColour("2563eb")).toBe("#2563eb");
    expect(parseHexColour("  #7C3AED ")).toBe("#7c3aed");
  });

  it("widens three digits to six", () => {
    expect(parseHexColour("#f80")).toBe("#ff8800");
    expect(parseHexColour("ABC")).toBe("#aabbcc");
  });

  it("refuses anything else", () => {
    expect(parseHexColour("")).toBeNull();
    expect(parseHexColour("#12")).toBeNull();
    expect(parseHexColour("#1234")).toBeNull();
    expect(parseHexColour("#12345")).toBeNull();
    expect(parseHexColour("#1234567")).toBeNull();
    expect(parseHexColour("#gg0000")).toBeNull();
    expect(parseHexColour("red")).toBeNull();
  });
});

describe("deleteLabelWarning", () => {
  it("says how many tickets lose the label", () => {
    expect(deleteLabelWarning(0)).toBe("No tickets use it.");
    expect(deleteLabelWarning(1)).toBe("1 ticket loses it.");
    expect(deleteLabelWarning(12)).toBe("12 tickets lose it.");
  });
});
