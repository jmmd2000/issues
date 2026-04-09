import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { db } from "../db";
import { sessions } from "../db/schema";
import { eq, and, gt } from "drizzle-orm";

type Env = { Variables: { userID: string } };
type OptionalEnv = { Variables: { userID?: string } };

/** Looks up a valid, non-expired session by ID. Returns the userID or null. */
async function findValidSession(sessionID: string) {
  const [session] = await db
    .select({ userID: sessions.userID })
    .from(sessions)
    .where(and(eq(sessions.id, sessionID), gt(sessions.expiresAt, new Date())))
    .limit(1);

  return session ?? null;
}

/**
 * Requires a valid session cookie. Rejects with 401 if missing or expired.
 *
 * Sets `userID` on the context for downstream handlers.
 */
export const requireAuth = createMiddleware<Env>(async (c, next) => {
  const sessionID = getCookie(c, "session_id");
  if (!sessionID) throw new HTTPException(401, { message: "Not authenticated." });

  const session = await findValidSession(sessionID);
  if (!session) throw new HTTPException(401, { message: "Session expired." });

  c.set("userID", session.userID);
  await next();
});

/**
 * Resolves identity when present but allows anonymous access.
 *
 * No cookie: continues as anonymous (no `userID` set).
 *
 * Valid cookie: sets `userID` on the context.
 *
 * Invalid/expired cookie: rejects with 401.
 */
export const optionalAuth = createMiddleware<OptionalEnv>(async (c, next) => {
  const sessionID = getCookie(c, "session_id");
  if (!sessionID) {
    await next();
  } else {
    const session = await findValidSession(sessionID);
    if (!session) throw new HTTPException(401, { message: "Session expired." });

    c.set("userID", session.userID);
    await next();
  }
});
