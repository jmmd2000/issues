import { db } from "../db";
import app from "../index";
import argon2 from "argon2";
import { sql } from "drizzle-orm";
import { sessions, users } from "../db/schema";

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
export async function createProject(
  cookies: string,
  overrides: {
    key?: string;
    name?: string;
    description?: string;
    visibility?: "public" | "private";
    repo?: string | null;
    stack?: string[];
  } = {}
) {
  const { key = "TEST", name = "Test Project", description = "A test project", visibility = "public", repo = null, stack = [] } = overrides;

  const res = await app.request("/api/projects/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookies },
    body: JSON.stringify({ key, name, description, visibility, repo, stack }),
  });

  const body = await res.json();
  return body.project;
}

/**
 * Test helper to patch a project via the API
 * @returns the updated project object
 */
export async function updateProject(
  cookies: string,
  key: string,
  overrides: {
    name?: string;
    description?: string;
    metadata?: Record<string, unknown>;
    visibility?: "public" | "private";
    repo?: string | null;
    stack?: string[];
  } = {}
) {
  const { name = "Updated Project", description = "An updated test project", metadata = {}, visibility = "public", repo = null, stack = [] } = overrides;

  const res = await app.request(`/api/projects/${key}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookies },
    body: JSON.stringify({ name, description, metadata, visibility, repo, stack }),
  });

  const body = await res.json();
  return body.project;
}

/**
 * Test helper to create an additional authenticated user directly via the DB,
 * bypassing the single-user registration lock.
 * @returns the user record and auth cookies
 */
export async function createExtraUser(name: string, email: string, password = "password123") {
  const passwordHash = await argon2.hash(password);
  const [user] = await db.insert(users).values({ name, email, passwordHash }).returning();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  const [session] = await db.insert(sessions).values({ userID: user.id, expiresAt }).returning();
  return { user, cookies: `session_id=${session.id}` };
}

/**
 * Test helper to wipe the database
 */
export async function resetDatabase() {
  await db.execute(sql`TRUNCATE TABLE labels, statuses, project_members, projects, sessions, users CASCADE`);
}
