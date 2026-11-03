/**
 * Adds sources to one directive of a Content-Security-Policy header value. It
 * skips sources the directive already lists.
 * @param policy The header value, such as `default-src 'self'; connect-src 'self'`
 * @param directive The directive to change, such as `connect-src`
 * @param sources The sources to add, such as `https://glitchtip.example.com`
 * @returns The new header value
 * @throws Error when the policy has no such directive, because adding it would replace the `default-src` fallback
 */
export function addSources(policy: string, directive: string, sources: string[]): string {
  const directives = policy
    .split(";")
    .map(part => part.trim())
    .filter(part => part !== "");
  const index = directives.findIndex(part => part.split(/\s+/)[0] === directive);
  if (index === -1) throw new Error(`The Content-Security-Policy has no ${directive} directive`);

  const existing = directives[index].split(/\s+/);
  const added = sources.filter(source => !existing.includes(source));
  const updated = [...existing, ...added].join(" ");
  return directives.map((part, position) => (position === index ? updated : part)).join("; ");
}
