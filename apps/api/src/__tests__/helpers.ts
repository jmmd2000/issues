import { createHash, randomBytes } from "node:crypto";
import { db } from "../db";
import app from "../index";
import argon2 from "argon2";
import { eq, sql } from "drizzle-orm";
import { apiTokens, projectMembers, projects, sessions, statuses, users } from "../db/schema";
import { getEnv } from "../lib/env";
import { assertTestDatabase } from "./setup/assertTestDatabase";

/**
 * Test helper to create and login with a dummy user
 * @returns the cookies for use with auth-protected endpoints and the user record
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
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return { cookies, user };
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
 * Test helper to create a ticket in any project through the API, using that
 * project's first status.
 * @returns the created ticket
 */
export async function createTicketInProject(cookies: string, projectKey: string, title: string, visibility: "public" | "private" = "public") {
  const [status] = await db.select({ id: statuses.id }).from(statuses).innerJoin(projects, eq(statuses.projectID, projects.id)).where(eq(projects.key, projectKey)).limit(1);

  const res = await app.request(`/api/projects/${projectKey}/tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookies },
    body: JSON.stringify({ title, statusID: status.id, visibility }),
  });
  const body = await res.json();
  return body.ticket;
}

/**
 * Test helper that builds the tickets a link can point at, and a viewer who
 * can see only some of them. The viewer is a member of the source project and
 * of nothing else. The owner is a member of every project.
 *
 * - `PRIV-1`: a ticket in a private project
 * - `PUB-1`: a public ticket in a public project
 * - `PUB-2`: a private ticket in a public project
 * @param ownerCookies the cookies of the user who owns every project
 * @param sourceProjectID the project the links start from
 * @returns the viewer's cookies and the private project's ID
 */
export async function createLinkTargets(ownerCookies: string, sourceProjectID: string) {
  const { user: viewer, cookies: viewerCookies } = await createExtraUser("Viewer", "viewer@test.com");
  await db.insert(projectMembers).values({ projectID: sourceProjectID, userID: viewer.id, role: "member" });

  const privateProject = await createProject(ownerCookies, { key: "PRIV", name: "Private project", visibility: "private" });
  await createProject(ownerCookies, { key: "PUB", name: "Public project", visibility: "public" });
  await createTicketInProject(ownerCookies, "PRIV", "Hidden in a private project");
  await createTicketInProject(ownerCookies, "PUB", "Visible public ticket");
  await createTicketInProject(ownerCookies, "PUB", "Hidden in a public project", "private");

  return { viewerCookies, privateProjectID: privateProject.id };
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
 * Test helper to wipe the database. Throws unless the connection is a local `_test` database.
 */
export async function resetDatabase() {
  assertTestDatabase(getEnv().DATABASE_URL, process.env.NODE_ENV);
  await db.execute(sql`TRUNCATE TABLE labels, statuses, project_members, projects, sessions, users CASCADE`);
}

/**
 * Test helper to create a service (bot) user directly via the DB.
 * Service users have no usable login; they are reached only through API tokens.
 * @returns the user record
 */
export async function createServiceUser(name = "Claude", email = `${name.toLowerCase()}-${Date.now()}@service.local`) {
  const passwordHash = await argon2.hash(randomBytes(48).toString("hex"));
  const [user] = await db.insert(users).values({ name, email, passwordHash, isService: true }).returning();
  return { user };
}

/**
 * Test helper to create an API token directly in the DB, bypassing the route layer.
 * Mirrors TokenService.createToken so tests can seed valid, expired, or otherwise
 * edge-case tokens without going through HTTP.
 * @returns The raw bearer token and the persisted record
 */
export async function createTokenForUser(userID: string, opts: { name?: string; expiresAt?: Date } = {}) {
  const { name = "Test Token", expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90) } = opts;
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const [record] = await db.insert(apiTokens).values({ userID, name, tokenHash, expiresAt }).returning();
  return { token, record };
}
