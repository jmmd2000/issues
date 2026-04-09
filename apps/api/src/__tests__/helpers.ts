import { sql } from "drizzle-orm";
import { db } from "../db";
import app from "../index";

/**
 * Test helper to create and login with a dummy user
 * @returns the cookies for use with auth-protected endpoints
 */
export async function createAuthenticatedUser(name = "Test User", email = "test@test.com", password = "password123") {
  await app.request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });

  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const cookies = res.headers.get("set-cookie") ?? "";
  return { cookies };
}

/**
 * Test helper to wipe the database
 */
export async function resetDatabase() {
  await db.execute(sql`TRUNCATE TABLE labels, statuses, project_members, projects, sessions, users CASCADE`);
}
