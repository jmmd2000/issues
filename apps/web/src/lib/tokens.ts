const DAY = 24 * 60 * 60 * 1000;

/** A token that expires within this many days is marked as expiring soon. */
export const EXPIRY_WARNING_DAYS = 14;

/** The lifetimes a new token can have, in days. */
export const EXPIRY_CHOICES = [7, 30, 90, 180, 365] as const;
export const DEFAULT_EXPIRY_DAYS = 90;

/** Whole days until the token expires, counting a part day as a full day. Zero or less means it has expired. */
export function daysLeft(expiresAt: string, now: Date = new Date()): number {
  return Math.ceil((Date.parse(expiresAt) - now.getTime()) / DAY);
}

export interface ExpiryLabel {
  text: string;
  tone: "ok" | "soon" | "expired";
}

/** The text and tone that show how long a token has left. */
export function expiryLabel(days: number): ExpiryLabel {
  if (days <= 0) return { text: "Expired", tone: "expired" };
  if (days <= EXPIRY_WARNING_DAYS) return { text: `Expires in ${days} ${days === 1 ? "day" : "days"}`, tone: "soon" };
  return { text: `${days} days left`, tone: "ok" };
}
