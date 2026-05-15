import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { db } from "../db";
import { sessions } from "../db/schema";
import { eq, and, gt } from "drizzle-orm";
import { TokenService } from "../services/tokenService";

type Env = { Variables: { userID: string } };
type OptionalEnv = { Variables: { userID?: string } };

const BEARER_PREFIX = "Bearer ";

/** Looks up a valid, non-expired session by ID. Returns the userID or null. */
async function findValidSession(sessionID: string) {
  const [session] = await db
    .select({ userID: sessions.userID })
    .from(sessions)
    .where(and(eq(sessions.id, sessionID), gt(sessions.expiresAt, new Date())))
    .limit(1);

  return session ?? null;
}

/** Pulls the raw bearer value out of an Authorization header, if any. */
function extractBearer(authHeader: string | undefined) {
  if (!authHeader || !authHeader.startsWith(BEARER_PREFIX)) return null;
  const raw = authHeader.slice(BEARER_PREFIX.length).trim();
  return raw || null;
}

/**
 * Requires either a valid session cookie or a valid `Authorization: Bearer`
 * token. Cookie wins if both are present so cookie-authenticated routes are
 * unaffected by stray bearer headers from non-browser clients.
 *
 * Sets `userID` on the context for downstream handlers.
 */
export const requireAuth = createMiddleware<Env>(async (c, next) => {
  const sessionID = getCookie(c, "session_id");
  if (sessionID) {
    const session = await findValidSession(sessionID);
    if (!session) throw new HTTPException(401, { message: "Session expired." });
    c.set("userID", session.userID);
    await next();
    return;
  }

  const raw = extractBearer(c.req.header("authorization"));
  if (raw) {
    const token = await TokenService.findByRawToken(raw);
    if (!token) throw new HTTPException(401, { message: "Invalid or expired token." });
    c.set("userID", token.userID);
    await next();
    return;
  }

  throw new HTTPException(401, { message: "Not authenticated." });
});

/**
 * Resolves identity when present but allows anonymous access.
 *
 * No credentials: continues as anonymous (no `userID` set).
 *
 * Invalid cookie or invalid/expired bearer: rejects with 401.
 *
 * Valid credentials: sets `userID` on the context. Cookie wins if both are
 * present.
 */
export const optionalAuth = createMiddleware<OptionalEnv>(async (c, next) => {
  const sessionID = getCookie(c, "session_id");
  if (sessionID) {
    const session = await findValidSession(sessionID);
    if (!session) throw new HTTPException(401, { message: "Session expired." });
    c.set("userID", session.userID);
    await next();
    return;
  }

  const raw = extractBearer(c.req.header("authorization"));
  if (raw) {
    const token = await TokenService.findByRawToken(raw);
    if (!token) throw new HTTPException(401, { message: "Invalid or expired token." });
    c.set("userID", token.userID);
    await next();
    return;
  }

  await next();
});
