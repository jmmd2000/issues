import { describe, it, expect } from "vitest";
import { placeMenu } from "./popoverPlacement";

const viewport = { width: 1440, height: 900 };
const menu = { width: 200, height: 160 };

function triggerAt(left: number, top: number) {
  return { left, right: left + 32, top, bottom: top + 32 };
}

describe("placeMenu", () => {
  it("opens below and left-aligned when there is room", () => {
    expect(placeMenu(triggerAt(100, 100), menu, viewport)).toEqual({ align: "start", side: "below" });
  });

  it("aligns to the trigger's right edge when the menu would pass the right edge of the window", () => {
    expect(placeMenu(triggerAt(1400, 100), menu, viewport)).toEqual({ align: "end", side: "below" });
  });

  it("opens above when the menu would pass the bottom edge of the window", () => {
    expect(placeMenu(triggerAt(100, 850), menu, viewport)).toEqual({ align: "start", side: "above" });
  });

  it("flips both ways in the bottom right corner", () => {
    expect(placeMenu(triggerAt(1400, 850), menu, viewport)).toEqual({ align: "end", side: "above" });
  });

  it("keeps the menu below when it fits exactly at the bottom edge", () => {
    const trigger = triggerAt(100, viewport.height - menu.height - 6 - 32);
    expect(placeMenu(trigger, menu, viewport).side).toBe("below");
  });

  it("picks the side with more room when the menu fits on neither side", () => {
    const narrow = { width: 150, height: 900 };
    expect(placeMenu(triggerAt(20, 100), menu, narrow).align).toBe("start");
    expect(placeMenu(triggerAt(100, 100), menu, narrow).align).toBe("end");

    const short = { width: 1440, height: 200 };
    expect(placeMenu(triggerAt(100, 20), menu, short).side).toBe("below");
    expect(placeMenu(triggerAt(100, 120), menu, short).side).toBe("above");
  });
});
