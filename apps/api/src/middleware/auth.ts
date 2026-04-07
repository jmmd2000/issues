import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { db } from "../db";
import { sessions } from "../db/schema";
import { eq, and, gt } from "drizzle-orm";

type Env = { Variables: { userID: string } };

export const requireAuth = createMiddleware<Env>(async (c, next) => {
  const sessionID = getCookie(c, "session_id");
  if (!sessionID) throw new HTTPException(401, { message: "Not authenticated." });

  const [session] = await db
    .select({ userID: sessions.userID })
    .from(sessions)
    .where(and(eq(sessions.id, sessionID), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!session) throw new HTTPException(401, { message: "Session expired." });

  c.set("userID", session.userID);
  await next();
});
