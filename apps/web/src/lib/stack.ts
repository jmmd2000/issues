/**
 * Parses a comma-separated stack string into a trimmed list of technologies.
 * Shared by the New Project form and the project General settings form so both
 * surfaces accept the same "SvelteKit, Hono, PostgreSQL" syntax.
 *
 * @param value Raw comma-separated input.
 * @returns Non-empty, trimmed technology names in their original order.
 */
export function getStackItems(value: string): string[] {
  return value
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

/** Technologies offered as one-click suggestions on the New project form. */
export const STACK_SUGGESTIONS = ["SvelteKit", "TypeScript", "Hono", "PostgreSQL", "Drizzle", "Zod", "Docker", "Playwright", "Node.js"] as const;

/**
 * Adds a technology to the end of a stack list. An empty entry, or one the list already
 * has (ignoring case), leaves the list as it was.
 *
 * @returns A new list. The one passed in is not changed.
 */
export function addStackItem(items: readonly string[], value: string): string[] {
  const item = value.trim();
  if (!item || items.some(existing => existing.toLowerCase() === item.toLowerCase())) return [...items];
  return [...items, item];
}
