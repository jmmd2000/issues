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
 * Test helper to create a project via the API
 * @returns the created project object
 */
export async function createProject(cookies: string, overrides: { key?: string; name?: string; description?: string; visibility?: "public" | "private" } = {}) {
  const { key = "TEST", name = "Test Project", description = "A test project", visibility = "public" } = overrides;

  const res = await app.request("/api/projects/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookies },
    body: JSON.stringify({ key, name, description, visibility }),
  });

  const body = await res.json();
  return body.project;
}

/**
 * Test helper to wipe the database
 */
export async function resetDatabase() {
  await db.execute(sql`TRUNCATE TABLE labels, statuses, project_members, projects, sessions, users CASCADE`);
}
