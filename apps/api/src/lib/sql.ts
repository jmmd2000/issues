import type { SQL } from "drizzle-orm";

/**
 * Narrows the result of drizzle's `and()` or `or()`, which return `undefined`
 * only when given no conditions. Throws instead of returning `undefined`, so a
 * visibility filter can never silently turn into "no filter".
 * @param condition The result of `and()` or `or()`
 * @throws Error if the condition is `undefined`
 */
export function requireCondition(condition: SQL | undefined): SQL {
  if (!condition) throw new Error("Expected a SQL condition but received none.");
  return condition;
}

/** Postgres unique-violation SQLSTATE check. It walks the `cause` chain because Drizzle wraps `pg` errors. */
export function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  while (current && typeof current === "object") {
    if ("code" in current && (current as { code: unknown }).code === "23505") return true;
    current = "cause" in current ? (current as { cause: unknown }).cause : null;
  }
  return false;
}
