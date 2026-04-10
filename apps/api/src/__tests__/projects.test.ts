import { describe, it, expect, beforeEach } from "vitest";
import app from "../index";
import { db } from "../db";
import { labels, projectMembers, sessions, statuses } from "../db/schema";
import { eq } from "drizzle-orm";
import { createAuthenticatedUser, createExtraUser, createProject, resetDatabase, updateProject } from "./helpers";

let cookies: string;

describe("POST /api/projects/create", () => {
  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
  });

  it("creates project", async () => {
    const res = await app.request("/api/projects/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ key: "TEST", name: "Test Project", description: "This is a new project", visibility: "public" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.project.name).toBe("Test Project");
    expect(body.project.repo).toBeNull();
    expect(body.project.stack).toEqual([]);
  });

  it("returns 401 for non-authenticated requests", async () => {
    const res = await app.request("/api/projects/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "TEST", name: "Test Project", description: "This is a new project", visibility: "public" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects duplicate project key", async () => {
    await app.request("/api/projects/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ key: "DUPE", name: "First", description: "First project", visibility: "public" }),
    });

    const res = await app.request("/api/projects/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ key: "DUPE", name: "Second", description: "Second project", visibility: "public" }),
    });
    expect(res.status).toBe(500);
  });

  it("rejects key shorter than 2 characters", async () => {
    const res = await app.request("/api/projects/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ key: "A", name: "Short Key", description: "Too short", visibility: "public" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects key longer than 6 characters", async () => {
    const res = await app.request("/api/projects/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ key: "TOOLONG", name: "Long Key", description: "Too long", visibility: "public" }),
    });
    expect(res.status).toBe(400);
  });

  it("uppercases the project key", async () => {
    const res = await app.request("/api/projects/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ key: "test", name: "Uppercase Test", description: "Should uppercase", visibility: "public" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.project.key).toBe("TEST");
  });

  it("rejects missing required fields", async () => {
    const res = await app.request("/api/projects/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ key: "NO" }),
    });
    expect(res.status).toBe(400);
  });

  it("seeds default statuses and labels on creation", async () => {
    const res = await app.request("/api/projects/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ key: "SEED", name: "Seed Test", description: "Check seeding", visibility: "public" }),
    });
    const body = await res.json();
    const projectID = body.project.id;

    const seededStatuses = await db.select().from(statuses).where(eq(statuses.projectID, projectID));
    expect(seededStatuses).toHaveLength(4);

    const seededLabels = await db.select().from(labels).where(eq(labels.projectID, projectID));
    expect(seededLabels).toHaveLength(5);
  });

  it("assigns creator as project owner", async () => {
    const res = await app.request("/api/projects/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ key: "OWN", name: "Owner Test", description: "Check ownership", visibility: "public" }),
    });
    const body = await res.json();
    const projectID = body.project.id;

    const members = await db.select().from(projectMembers).where(eq(projectMembers.projectID, projectID));
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe("owner");
  });

  it("persists private visibility", async () => {
    const res = await app.request("/api/projects/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ key: "PRIV", name: "Private Project", description: "Should be private", visibility: "private" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.project.visibility).toBe("private");
  });

  it("rejects invalid repo URL", async () => {
    const res = await app.request("/api/projects/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({
        key: "BAD",
        name: "Bad Repo",
        description: "Invalid URL",
        visibility: "public",
        repo: "not-a-url",
        stack: [],
      }),
    });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/projects/", () => {
  let cookies: string;

  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
  });

  it("returns public projects for anonymous users", async () => {
    await createProject(cookies, { key: "PUB", name: "Public", visibility: "public" });
    await createProject(cookies, { key: "PRIV", name: "Private", visibility: "private" });

    const res = await app.request("/api/projects/", { method: "GET" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.projects).toHaveLength(1);
    expect(body.projects[0].name).toBe("Public");
  });

  it("returns public and member projects for authenticated users", async () => {
    await createProject(cookies, { key: "PUB", name: "Public", visibility: "public" });
    await createProject(cookies, { key: "PRIV", name: "Private", visibility: "private" });

    const res = await app.request("/api/projects/", {
      method: "GET",
      headers: { Cookie: cookies },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.projects).toHaveLength(2);
  });

  it("does not return private projects the user is not a member of", async () => {
    await createProject(cookies, { key: "PRIV", visibility: "private" });
    const { cookies: otherCookies } = await createExtraUser("Other", "other@test.com");

    const res = await app.request("/api/projects/", {
      method: "GET",
      headers: { Cookie: otherCookies },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.projects).toHaveLength(0);
  });

  it("returns public projects but not non-member private ones for authed users", async () => {
    await createProject(cookies, { key: "PUB", visibility: "public" });
    await createProject(cookies, { key: "PRIV", visibility: "private" });
    const { cookies: otherCookies } = await createExtraUser("Other", "other@test.com");

    const res = await app.request("/api/projects/", {
      method: "GET",
      headers: { Cookie: otherCookies },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.projects).toHaveLength(1);
    expect(body.projects[0].key).toBe("PUB");
  });

  it("returns empty array when no projects exist", async () => {
    const res = await app.request("/api/projects/", { method: "GET" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.projects).toHaveLength(0);
  });

  it("returns 401 for expired session cookie", async () => {
    await db.delete(sessions);

    const res = await app.request("/api/projects/", {
      method: "GET",
      headers: { Cookie: cookies },
    });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/projects/:key", () => {
  let cookies: string;

  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
  });

  it("returns project with statuses, labels, and members", async () => {
    await createProject(cookies, { key: "PROJ" });

    const res = await app.request("/api/projects/PROJ", { method: "GET" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.project.key).toBe("PROJ");
    expect(body.project.statuses).toHaveLength(4);
    expect(body.project.labels).toHaveLength(5);
    expect(body.project.members).toHaveLength(1);
  });

  it("returns member user details", async () => {
    await createProject(cookies, { key: "PROJ" });

    const res = await app.request("/api/projects/PROJ", {
      method: "GET",
      headers: { Cookie: cookies },
    });

    const body = await res.json();
    const member = body.project.members[0];
    expect(member.role).toBe("owner");
    expect(member.user.name).toBe("Test User");
    expect(member.user.email).toBe("test@test.com");
    expect(member.user).not.toHaveProperty("passwordHash");
  });

  it("hides member email from anonymous viewers", async () => {
    await createProject(cookies, { key: "PUB", visibility: "public" });

    const res = await app.request("/api/projects/PUB", { method: "GET" });

    const body = await res.json();
    const member = body.project.members[0];
    expect(member.user.name).toBe("Test User");
    expect(member.user).not.toHaveProperty("email");
  });

  it("returns public project for anonymous users", async () => {
    await createProject(cookies, { key: "PUB", visibility: "public" });

    const res = await app.request("/api/projects/PUB", { method: "GET" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.project.key).toBe("PUB");
  });

  it("returns private project for authenticated member", async () => {
    await createProject(cookies, { key: "PRIV", visibility: "private" });

    const res = await app.request("/api/projects/PRIV", {
      method: "GET",
      headers: { Cookie: cookies },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.project.key).toBe("PRIV");
  });

  it("returns 404 for private project when anonymous", async () => {
    await createProject(cookies, { key: "PRIV", visibility: "private" });

    const res = await app.request("/api/projects/PRIV", { method: "GET" });

    expect(res.status).toBe(404);
  });

  it("returns 404 for non-existent project", async () => {
    const res = await app.request("/api/projects/NOPE", { method: "GET" });

    expect(res.status).toBe(404);
  });

  it("uppercases key param for lookup", async () => {
    await createProject(cookies, { key: "UP" });

    const res = await app.request("/api/projects/up", { method: "GET" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.project.key).toBe("UP");
  });

  it("returns 400 for key shorter than 2 characters", async () => {
    const res = await app.request("/api/projects/A", { method: "GET" });

    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/projects/:key", () => {
  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
  });

  it("updates name, description, repo, stack, metadata, and visibility", async () => {
    await createProject(cookies, { key: "PROJ", visibility: "public" });

    const res = await app.request("/api/projects/PROJ", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({
        name: "New Name",
        description: "New description",
        repo: "https://github.com/x/y",
        stack: ["Hono", "Drizzle"],
        metadata: { docs: "https://docs.example.com", notes: "main side project" },
        visibility: "private",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.project.name).toBe("New Name");
    expect(body.project.description).toBe("New description");
    expect(body.project.repo).toBe("https://github.com/x/y");
    expect(body.project.stack).toEqual(["Hono", "Drizzle"]);
    expect(body.project.metadata).toEqual({ docs: "https://docs.example.com", notes: "main side project" });
    expect(body.project.visibility).toBe("private");
  });

  it("returns full project shape with statuses, labels, and members", async () => {
    await createProject(cookies, { key: "PROJ" });

    const updated = await updateProject(cookies, "PROJ", { name: "Changed" });

    expect(updated.statuses).toHaveLength(4);
    expect(updated.labels).toHaveLength(5);
    expect(updated.members).toHaveLength(1);
  });

  it("returns 401 when not authenticated", async () => {
    await createProject(cookies, { key: "PROJ" });

    const res = await app.request("/api/projects/PROJ", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "X", description: "X", repo: null, stack: [], metadata: {}, visibility: "public" }),
    });

    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent project", async () => {
    const res = await app.request("/api/projects/NOPE", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "X", description: "X", repo: null, stack: [], metadata: {}, visibility: "public" }),
    });

    expect(res.status).toBe(404);
  });

  it("returns 404 when authed user is not a member of a public project", async () => {
    await createProject(cookies, { key: "PUB", visibility: "public" });
    const { cookies: otherCookies } = await createExtraUser("Other", "other@test.com");

    const res = await app.request("/api/projects/PUB", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: otherCookies },
      body: JSON.stringify({ name: "Hacked", description: "X", repo: null, stack: [], metadata: {}, visibility: "public" }),
    });

    expect(res.status).toBe(404);
  });

  it("returns 404 when authed user is not a member of a private project", async () => {
    await createProject(cookies, { key: "PRIV", visibility: "private" });
    const { cookies: otherCookies } = await createExtraUser("Other", "other@test.com");

    const res = await app.request("/api/projects/PRIV", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: otherCookies },
      body: JSON.stringify({ name: "Hacked", description: "X", repo: null, stack: [], metadata: {}, visibility: "private" }),
    });

    expect(res.status).toBe(404);
  });

  it("allows members to update private projects", async () => {
    await createProject(cookies, { key: "PRIV", visibility: "private" });

    const updated = await updateProject(cookies, "PRIV", { name: "Renamed", visibility: "private" });

    expect(updated.name).toBe("Renamed");
    expect(updated.visibility).toBe("private");
  });

  it("rejects attempt to change key via body", async () => {
    await createProject(cookies, { key: "PROJ" });

    const res = await app.request("/api/projects/PROJ", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({
        name: "X",
        description: "X",
        repo: null,
        stack: [],
        metadata: {},
        visibility: "public",
        key: "HACK",
      }),
    });

    expect(res.status).toBe(400);
  });

  it("clears repo when set to null", async () => {
    await createProject(cookies, { key: "PROJ", repo: "https://github.com/x/y" });

    const updated = await updateProject(cookies, "PROJ", { repo: null });

    expect(updated.repo).toBeNull();
  });

  it("uppercases key param for lookup", async () => {
    await createProject(cookies, { key: "UP" });

    const updated = await updateProject(cookies, "up", { name: "Changed" });

    expect(updated.key).toBe("UP");
    expect(updated.name).toBe("Changed");
  });
});

describe("DELETE /api/projects/:key", () => {
  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
  });

  it("deletes project as owner", async () => {
    await createProject(cookies, { key: "PROJ" });

    const res = await app.request("/api/projects/PROJ", {
      method: "DELETE",
      headers: { Cookie: cookies },
    });

    expect(res.status).toBe(204);

    const getRes = await app.request("/api/projects/PROJ", {
      method: "GET",
      headers: { Cookie: cookies },
    });
    expect(getRes.status).toBe(404);
  });

  it("cascades deletion to statuses, labels, and members", async () => {
    const project = await createProject(cookies, { key: "PROJ" });

    await app.request("/api/projects/PROJ", {
      method: "DELETE",
      headers: { Cookie: cookies },
    });

    const remainingStatuses = await db.select().from(statuses).where(eq(statuses.projectID, project.id));
    const remainingLabels = await db.select().from(labels).where(eq(labels.projectID, project.id));
    const remainingMembers = await db.select().from(projectMembers).where(eq(projectMembers.projectID, project.id));
    expect(remainingStatuses).toHaveLength(0);
    expect(remainingLabels).toHaveLength(0);
    expect(remainingMembers).toHaveLength(0);
  });

  it("returns 401 when not authenticated", async () => {
    await createProject(cookies, { key: "PROJ" });

    const res = await app.request("/api/projects/PROJ", { method: "DELETE" });

    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent project", async () => {
    const res = await app.request("/api/projects/NOPE", {
      method: "DELETE",
      headers: { Cookie: cookies },
    });

    expect(res.status).toBe(404);
  });

  it("returns 404 when authed user is not a member", async () => {
    await createProject(cookies, { key: "PROJ" });
    const { cookies: otherCookies } = await createExtraUser("Other", "other@test.com");

    const res = await app.request("/api/projects/PROJ", {
      method: "DELETE",
      headers: { Cookie: otherCookies },
    });

    expect(res.status).toBe(404);
  });

  it("returns 403 when authed member is not owner", async () => {
    const project = await createProject(cookies, { key: "PROJ" });
    const { user: otherUser, cookies: otherCookies } = await createExtraUser("Other", "other@test.com");
    await db.insert(projectMembers).values({ projectID: project.id, userID: otherUser.id, role: "member" });

    const res = await app.request("/api/projects/PROJ", {
      method: "DELETE",
      headers: { Cookie: otherCookies },
    });

    expect(res.status).toBe(403);
  });

  it("uppercases key param for lookup", async () => {
    await createProject(cookies, { key: "UP" });

    const res = await app.request("/api/projects/up", {
      method: "DELETE",
      headers: { Cookie: cookies },
    });

    expect(res.status).toBe(204);
  });

  it("returns 400 for key shorter than 2 characters", async () => {
    const res = await app.request("/api/projects/A", {
      method: "DELETE",
      headers: { Cookie: cookies },
    });

    expect(res.status).toBe(400);
  });
});
