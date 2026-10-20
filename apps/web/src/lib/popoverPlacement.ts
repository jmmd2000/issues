export interface TriggerBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Placement {
  /** "start" lines the menu up with the trigger's left edge, "end" with its right edge. */
  align: "start" | "end";
  /** "below" opens the menu under the trigger, "above" opens it over the trigger. */
  side: "below" | "above";
}

/**
 * Picks where a menu opens so that it stays inside the window.
 * It prefers left-aligned and below the trigger. When neither fits, it picks the side with more room.
 * @param gap The space between the trigger and the menu, in pixels.
 */
export function placeMenu(trigger: TriggerBox, menu: Size, viewport: Size, gap = 6): Placement {
  return {
    align: pickAlign(trigger, menu, viewport),
    side: pickSide(trigger, menu, viewport, gap),
  };
}

function pickAlign(trigger: TriggerBox, menu: Size, viewport: Size): Placement["align"] {
  const startFits = trigger.left + menu.width <= viewport.width;
  if (startFits) return "start";

  const endFits = trigger.right - menu.width >= 0;
  if (endFits) return "end";

  const spaceAtStart = viewport.width - trigger.left;
  const spaceAtEnd = trigger.right;
  return spaceAtStart >= spaceAtEnd ? "start" : "end";
}

function pickSide(trigger: TriggerBox, menu: Size, viewport: Size, gap: number): Placement["side"] {
  const belowFits = trigger.bottom + gap + menu.height <= viewport.height;
  if (belowFits) return "below";

  const aboveFits = trigger.top - gap - menu.height >= 0;
  if (aboveFits) return "above";

  const spaceBelow = viewport.height - trigger.bottom;
  const spaceAbove = trigger.top;
  return spaceBelow >= spaceAbove ? "below" : "above";
}
