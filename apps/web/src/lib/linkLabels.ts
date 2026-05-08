import type { LinkType } from "@issues/api";

export type LinkDirection = "outgoing" | "incoming";

export type LinkOption = {
  /** Stable composite key for select inputs. */
  key: string;
  linkType: LinkType;
  direction: LinkDirection;
  label: string;
};

const FORWARD: Record<LinkType, string> = {
  blocks: "blocks",
  depends_on: "depends on",
  duplicates: "duplicates",
  relates_to: "relates to",
};

const INVERSE: Record<LinkType, string> = {
  blocks: "is blocked by",
  depends_on: "is depended on by",
  duplicates: "is duplicated by",
  relates_to: "relates to",
};

// `relates_to` is symmetric, only need it once.
export const LINK_OPTIONS: ReadonlyArray<LinkOption> = [
  { key: "blocks:outgoing", linkType: "blocks", direction: "outgoing", label: FORWARD.blocks },
  { key: "blocks:incoming", linkType: "blocks", direction: "incoming", label: INVERSE.blocks },
  { key: "depends_on:outgoing", linkType: "depends_on", direction: "outgoing", label: FORWARD.depends_on },
  { key: "depends_on:incoming", linkType: "depends_on", direction: "incoming", label: INVERSE.depends_on },
  { key: "duplicates:outgoing", linkType: "duplicates", direction: "outgoing", label: FORWARD.duplicates },
  { key: "duplicates:incoming", linkType: "duplicates", direction: "incoming", label: INVERSE.duplicates },
  { key: "relates_to:outgoing", linkType: "relates_to", direction: "outgoing", label: FORWARD.relates_to },
];

/**
 * Returns the human-readable label for a link, picking the canonical phrase
 * for outgoing links and the inverse phrase for incoming ones.
 */
export function linkLabel(linkType: LinkType, direction: LinkDirection): string {
  return direction === "outgoing" ? FORWARD[linkType] : INVERSE[linkType];
}
