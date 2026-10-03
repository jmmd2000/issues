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
