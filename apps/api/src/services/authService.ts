import argon2 from "argon2";
import { db } from "../db";
import { sessions, users } from "../db/schema";
import { count, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7;

export class AuthService {
  /**
   * Creates a user as long as there are no existing users.
   * @param name User's name
   * @param email User's email
   * @param password User's password
   * @returns Created user array with name, email, avatarURL and createdAt
   * @throws {HTTPException} 403 if a user already exists
   */
  static async createUser(name: string, email: string, password: string) {
    const existingUsers = await db.select({ count: count() }).from(users);
    if (existingUsers[0].count > 0) throw new HTTPException(403, { message: "Max number of users already exists." });

    const passwordHash = await argon2.hash(password);
    return db.insert(users).values({ name, email, passwordHash }).returning({ name: users.name, email: users.email, avatarURL: users.avatarURL, createdAt: users.createdAt });
  }
  /**
   * Logs the user in by creating a session, given a correct password.
   * @param email User's email
   * @param password User's password
   * @returns Success status, session ID and expiry
   * @throws {HTTPException} 401 if credentials are invalid
   */
  static async loginUser(email: string, password: string) {
    const [user] = await db.select({ id: users.id, passwordHash: users.passwordHash }).from(users).where(eq(users.email, email)).limit(1);
    if (!user || !(await argon2.verify(user.passwordHash, password))) throw new HTTPException(401, { message: "Invalid credentials." });

    await db.delete(sessions).where(eq(sessions.userID, user.id));

    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    const [session] = await db.insert(sessions).values({ userID: user.id, expiresAt }).returning({ id: sessions.id, expiresAt: sessions.expiresAt });

    return { success: true, session };
  }

  /**
   * Logs the user out by deleting their session
   * @param sessionID User's session ID
   */
  static async logoutUser(sessionID: string) {
    await db.delete(sessions).where(eq(sessions.id, sessionID));
  }
}
