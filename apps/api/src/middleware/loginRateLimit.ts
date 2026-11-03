import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

interface AttemptWindow {
  count: number;
  resetAt: number;
}

const attemptsByIP = new Map<string, AttemptWindow>();

/**
 * Returns the address of the client that sent the request. Traefik puts the
 * address it got the connection from at the end of `X-Forwarded-For`, so the
 * last entry is the real client and entries a client forges come before it.
 * Without the header, it uses the socket address.
 */
export function clientIP(c: Context): string {
  const forwardedFor = c.req.header("x-forwarded-for");
  const lastForwarded = forwardedFor
    ?.split(",")
    .map(entry => entry.trim())
    .filter(entry => entry !== "")
    .at(-1);
  if (lastForwarded) return lastForwarded;

  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    // A request made with app.request() has no socket.
    return "unknown";
  }
}

function removeExpiredWindows(now: number) {
  for (const [ip, window] of attemptsByIP) {
    if (window.resetAt <= now) attemptsByIP.delete(ip);
  }
}

/** Forgets every attempt. Tests call it so one test's failed logins don't block the next. */
export function resetLoginRateLimit() {
  attemptsByIP.clear();
}

/**
 * Allows 5 login attempts from one client IP in 15 minutes, then answers 429
 * until the window ends. It counts an attempt before the handler runs, so
 * parallel requests can't get past the limit while argon2 is busy. A
 * successful login clears the count for that IP.
 */
export const loginRateLimit = createMiddleware(async (c, next) => {
  const now = Date.now();
  const ip = clientIP(c);
  removeExpiredWindows(now);

  const window = attemptsByIP.get(ip) ?? { count: 0, resetAt: now + WINDOW_MS };
  if (window.count >= MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((window.resetAt - now) / 1000);
    return c.json({ message: "Too many failed logins. Try again later." }, 429, { "Retry-After": String(retryAfterSeconds) });
  }

  attemptsByIP.set(ip, { count: window.count + 1, resetAt: window.resetAt });
  await next();
  if (c.res.status === 200) attemptsByIP.delete(ip);
});
