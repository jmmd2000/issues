import { describe, it, expect } from "vitest";
import { render } from "vitest-browser-svelte";
import "../../../app.css";
import { contrastRatio } from "$lib/test-utils/contrast";
import LabelChip from "./LabelChip.svelte";

const colours = ["#e11d48", "#2563eb", "#7c3aed", "#059669", "#6b7280", "#d97706", "#ffffff", "#000000", "#ffff00", "#00ffff", "#facc15", "#111111"];

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
