import { describe, it, expect } from "vitest";
import { render } from "vitest-browser-svelte";
import "../../../app.css";
import LabelChip from "./LabelChip.svelte";

const colours = ["#e11d48", "#2563eb", "#7c3aed", "#059669", "#6b7280", "#d97706", "#ffffff", "#000000", "#ffff00", "#00ffff", "#facc15", "#111111"];

function toChannels(colour: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("No canvas context");
  context.fillStyle = colour;
  context.fillRect(0, 0, 1, 1);
  return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3));
}

function luminance(colour: string) {
  const [red, green, blue] = toChannels(colour).map(channel => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: string, second: string) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("LabelChip", () => {
  for (const scheme of ["light", "dark"]) {
    it(`keeps its text at 4.5:1 or more against its tint for any label colour in ${scheme} mode`, async () => {
      document.documentElement.style.colorScheme = scheme;
      try {
        for (const colour of colours) {
          const screen = await render(LabelChip, { name: `Label ${colour}`, colour });
          const style = getComputedStyle(screen.getByText(`Label ${colour}`).element());
          expect(contrastRatio(style.color, style.backgroundColor), colour).toBeGreaterThanOrEqual(4.5);
        }
      } finally {
        document.documentElement.style.colorScheme = "";
      }
    });
  }
});
