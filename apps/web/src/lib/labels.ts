/** The colours offered when you pick a label colour. */
export const LABEL_PALETTE = ["#e11d48", "#2563eb", "#7c3aed", "#059669", "#6b7280", "#d97706", "#0891b2", "#db2777", "#65a30d", "#4f46e5"] as const;

/**
 * Reads a hex colour typed by hand. The `#` is optional, and three digits are widened to six.
 * @returns The colour as lowercase `#rrggbb`, or `null` when it is not a hex colour
 */
export function parseHexColour(value: string): string | null {
  const digits = value.trim().replace(/^#/, "");
  if (!/^[0-9a-f]+$/i.test(digits)) return null;
  if (digits.length === 3) {
    return `#${digits
      .split("")
      .map(digit => digit + digit)
      .join("")}`.toLowerCase();
  }
  if (digits.length === 6) return `#${digits}`.toLowerCase();
  return null;
}

/** Says what deleting a label does to tickets, for the confirmation in the label row. */
export function deleteLabelWarning(ticketCount: number): string {
  if (ticketCount === 0) return "No tickets use it.";
  if (ticketCount === 1) return "1 ticket loses it.";
  return `${ticketCount} tickets lose it.`;
}
