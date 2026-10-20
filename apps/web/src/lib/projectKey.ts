/** The fewest and most characters a project key can have. */
export const MIN_KEY_LENGTH = 2;
export const MAX_KEY_LENGTH = 6;

/** Keeps only letters and numbers, in capitals, up to the longest key. */
export function normaliseKey(value: string): string {
  return value
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase()
    .slice(0, MAX_KEY_LENGTH);
}

/** A key is two to six letters or numbers. */
export function isValidKey(key: string): boolean {
  return /^[A-Z0-9]+$/.test(key) && key.length >= MIN_KEY_LENGTH && key.length <= MAX_KEY_LENGTH;
}

/**
 * Suggests a key from a project name. One word gives its first four letters or numbers, so
 * "Dashboard" gives DASH. Several words give their initials, up to four, so "Personal website" gives PW.
 */
export function suggestKey(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .map(word => normaliseKey(word))
    .filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 4);
  return words
    .slice(0, 4)
    .map(word => word.charAt(0))
    .join("");
}
