import { describe, it, expect, beforeEach } from "vitest";
import app from "../index";
import { db } from "../db";
import { labels, projectMembers, sessions, statuses } from "../db/schema";
import { and, eq } from "drizzle-orm";
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
    expect(seededStatuses).toHaveLength(6);

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

    const res = await app.request("/api/projects", { method: "GET" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.projects).toHaveLength(1);
    expect(body.projects[0].name).toBe("Public");
  });

  it("returns public and member projects for authenticated users", async () => {
    await createProject(cookies, { key: "PUB", name: "Public", visibility: "public" });
    await createProject(cookies, { key: "PRIV", name: "Private", visibility: "private" });

    const res = await app.request("/api/projects", {
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

    const res = await app.request("/api/projects", {
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

    const res = await app.request("/api/projects", {
      method: "GET",
      headers: { Cookie: otherCookies },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.projects).toHaveLength(1);
    expect(body.projects[0].key).toBe("PUB");
  });

  it("returns empty array when no projects exist", async () => {
    const res = await app.request("/api/projects", { method: "GET" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.projects).toHaveLength(0);
  });

  it("returns 401 for expired session cookie", async () => {
    await db.delete(sessions);

    const res = await app.request("/api/projects", {
      method: "GET",
      headers: { Cookie: cookies },
    });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/projects/with-counts", () => {
  let cookies: string;

  async function createTicket(projectKey: string, statusID: string, title = "Ticket", visibility: "public" | "private" = "public") {
    const res = await app.request(`/api/projects/${projectKey}/tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ title, statusID, visibility }),
    });
    const body = await res.json();
    return body.ticket;
  }

  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await app.request("/api/projects/with-counts", { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("returns projects with openCount = 0 when there are no tickets", async () => {
    await createProject(cookies, { key: "ALPHA", name: "Alpha" });
    await createProject(cookies, { key: "BETA", name: "Beta" });

    const res = await app.request("/api/projects/with-counts", { method: "GET", headers: { Cookie: cookies } });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.projects).toHaveLength(2);
    for (const project of body.projects) {
      expect(project.openCount).toBe(0);
    }
  });

  it("counts only tickets in backlog or active status categories", async () => {
    const project = await createProject(cookies, { key: "MIX" });
    const projectStatuses = await db.select({ id: statuses.id, slug: statuses.slug }).from(statuses).where(eq(statuses.projectID, project.id));
    const backlog = projectStatuses.find((status) => status.slug === "backlog")!.id;
    const inProgress = projectStatuses.find((status) => status.slug === "in-progress")!.id;
    const done = projectStatuses.find((status) => status.slug === "done")!.id;
    const cancelled = projectStatuses.find((status) => status.slug === "cancelled")!.id;

    await createTicket("MIX", backlog, "Backlog A");
    await createTicket("MIX", backlog, "Backlog B");
    await createTicket("MIX", inProgress, "Active");
    await createTicket("MIX", done, "Closed");
    await createTicket("MIX", cancelled, "Cancelled");

    const res = await app.request("/api/projects/with-counts", { method: "GET", headers: { Cookie: cookies } });
    const body = await res.json();
    const mix = body.projects.find((p: { key: string; openCount: number }) => p.key === "MIX");
    expect(mix.openCount).toBe(3);
  });

  it("excludes soft-deleted tickets from the count", async () => {
    const project = await createProject(cookies, { key: "DEL" });
    const [{ id: backlog }] = await db
      .select({ id: statuses.id })
      .from(statuses)
      .where(and(eq(statuses.projectID, project.id), eq(statuses.slug, "backlog")));
    await createTicket("DEL", backlog, "Kept");
    const deleted = await createTicket("DEL", backlog, "Deleted");

    await app.request(`/api/projects/DEL/tickets/${deleted.number}`, { method: "DELETE", headers: { Cookie: cookies } });

    const res = await app.request("/api/projects/with-counts", { method: "GET", headers: { Cookie: cookies } });
    const body = await res.json();
    const del = body.projects.find((p: { key: string; openCount: number }) => p.key === "DEL");
    expect(del.openCount).toBe(1);
  });

  it("returns public projects and member private projects, omits non-member private", async () => {
    await createProject(cookies, { key: "PUB", visibility: "public" });
    await createProject(cookies, { key: "MINE", visibility: "private" });
    const { cookies: otherCookies } = await createExtraUser("Other", "other@test.com");
    await createProject(otherCookies, { key: "THEIRS", visibility: "private" });

    const res = await app.request("/api/projects/with-counts", { method: "GET", headers: { Cookie: cookies } });
    const body = await res.json();
    const keys = body.projects.map((p: { key: string }) => p.key).sort();
    expect(keys).toEqual(["MINE", "PUB"]);
  });

  it("excludes private tickets from openCount on non-member public projects", async () => {
    const project = await createProject(cookies, { key: "PUB", visibility: "public" });
    const [{ id: backlog }] = await db
      .select({ id: statuses.id })
      .from(statuses)
      .where(and(eq(statuses.projectID, project.id), eq(statuses.slug, "backlog")));
    await createTicket("PUB", backlog, "Public ticket");
    await createTicket("PUB", backlog, "Private ticket", "private");

    const { cookies: outsider } = await createExtraUser("Outsider", "outsider@test.com");
    const res = await app.request("/api/projects/with-counts", { method: "GET", headers: { Cookie: outsider } });
    const body = await res.json();
    const pub = body.projects.find((p: { key: string }) => p.key === "PUB");
    expect(pub.openCount).toBe(1);
  });

  it("includes private tickets in openCount on member projects", async () => {
    const project = await createProject(cookies, { key: "PUB", visibility: "public" });
    const [{ id: backlog }] = await db
      .select({ id: statuses.id })
      .from(statuses)
      .where(and(eq(statuses.projectID, project.id), eq(statuses.slug, "backlog")));
    await createTicket("PUB", backlog, "Public ticket");
    await createTicket("PUB", backlog, "Private ticket", "private");

    const res = await app.request("/api/projects/with-counts", { method: "GET", headers: { Cookie: cookies } });
    const body = await res.json();
    const pub = body.projects.find((p: { key: string }) => p.key === "PUB");
    expect(pub.openCount).toBe(2);
  });
});

describe("GET /api/projects/public", () => {
  let cookies: string;

  async function createTicket(projectKey: string, statusID: string, title = "Ticket", visibility: "public" | "private" = "public") {
    const res = await app.request(`/api/projects/${projectKey}/tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ title, statusID, visibility }),
    });
    const body = await res.json();
    return body.ticket;
  }

  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
  });

  it("returns 200 with no auth cookie", async () => {
    const res = await app.request("/api/projects/public", { method: "GET" });
    expect(res.status).toBe(200);
  });

  it("returns identical payload with or without a session cookie", async () => {
    await createProject(cookies, { key: "PUB", name: "Public", visibility: "public" });

    const anon = await app.request("/api/projects/public", { method: "GET" });
    const authed = await app.request("/api/projects/public", { method: "GET", headers: { Cookie: cookies } });

    expect(anon.status).toBe(200);
    expect(authed.status).toBe(200);
    const anonBody = await anon.json();
    const authedBody = await authed.json();
    expect(anonBody).toEqual(authedBody);
  });

  it("omits private projects entirely", async () => {
    await createProject(cookies, { key: "PUB", name: "Public", visibility: "public" });
    await createProject(cookies, { key: "PRIV", name: "Private", visibility: "private" });

    const res = await app.request("/api/projects/public", { method: "GET" });
    const body = await res.json();
    const keys = body.projects.map((p: { key: string }) => p.key);
    expect(keys).toEqual(["PUB"]);
  });

  it("counts only open tickets and excludes soft-deleted", async () => {
    const project = await createProject(cookies, { key: "PUB", visibility: "public" });
    const projectStatuses = await db.select({ id: statuses.id, slug: statuses.slug }).from(statuses).where(eq(statuses.projectID, project.id));
    const backlog = projectStatuses.find((status) => status.slug === "backlog")!.id;
    const done = projectStatuses.find((status) => status.slug === "done")!.id;
    await createTicket("PUB", backlog, "Open");
    await createTicket("PUB", done, "Closed");
    const deleted = await createTicket("PUB", backlog, "Deleted");
    await app.request(`/api/projects/PUB/tickets/${deleted.number}`, { method: "DELETE", headers: { Cookie: cookies } });

    const res = await app.request("/api/projects/public", { method: "GET" });
    const body = await res.json();
    expect(body.projects[0].openCount).toBe(1);
  });

  it("returns only the whitelisted fields", async () => {
    await createProject(cookies, { key: "PUB", name: "Public", description: "Hello", visibility: "public", repo: "https://example.com/repo", stack: ["ts"] });

    const res = await app.request("/api/projects/public", { method: "GET" });
    const body = await res.json();
    const project = body.projects[0];

    expect(Object.keys(project).sort()).toEqual(["description", "id", "key", "name", "openCount"]);
    expect(project).not.toHaveProperty("repo");
    expect(project).not.toHaveProperty("stack");
    expect(project).not.toHaveProperty("ownerID");
    expect(project).not.toHaveProperty("visibility");
    expect(project).not.toHaveProperty("metadata");
    expect(project).not.toHaveProperty("createdAt");
    expect(project).not.toHaveProperty("updatedAt");
  });

  it("excludes private tickets from openCount", async () => {
    const project = await createProject(cookies, { key: "PUB", visibility: "public" });
    const [{ id: backlog }] = await db
      .select({ id: statuses.id })
      .from(statuses)
      .where(and(eq(statuses.projectID, project.id), eq(statuses.slug, "backlog")));
    await createTicket("PUB", backlog, "Public ticket");
    await createTicket("PUB", backlog, "Private ticket", "private");

    const res = await app.request("/api/projects/public", { method: "GET" });
    const body = await res.json();
    expect(body.projects[0].openCount).toBe(1);
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
    expect(body.project.statuses).toHaveLength(6);
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

describe("GET /api/projects/:key/stats", () => {
  let projectID: string;
  let backlogStatusID: string;
  let doneStatusID: string;

  async function createTicket(authCookies: string, statusID: string, overrides: Partial<{ title: string; assigneeID: string | null; visibility: "public" | "private" }> = {}) {
    const res = await app.request("/api/projects/STATS/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: authCookies },
      body: JSON.stringify({ title: "Stat", statusID, ...overrides }),
    });
    const body = await res.json();
    return body.ticket;
  }

  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
    const project = await createProject(cookies, { key: "STATS" });
    projectID = project.id;
    const projectStatuses = await db.select({ id: statuses.id, slug: statuses.slug }).from(statuses).where(eq(statuses.projectID, projectID));
    backlogStatusID = projectStatuses.find((status) => status.slug === "backlog")!.id;
    doneStatusID = projectStatuses.find((status) => status.slug === "done")!.id;
  });

  it("returns zero counts for a fresh project", async () => {
    const res = await app.request("/api/projects/STATS/stats", { method: "GET", headers: { Cookie: cookies } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stats).toMatchObject({
      totalTickets: 0,
      openTickets: 0,
      closedTickets: 0,
      lastActivityAt: null,
      byMember: {},
    });
  });

  it("counts open vs closed tickets and tracks last activity", async () => {
    await createTicket(cookies, backlogStatusID, { title: "Open A" });
    await createTicket(cookies, backlogStatusID, { title: "Open B" });
    await createTicket(cookies, doneStatusID, { title: "Closed" });

    const res = await app.request("/api/projects/STATS/stats", { method: "GET", headers: { Cookie: cookies } });
    const body = await res.json();
    expect(body.stats.totalTickets).toBe(3);
    expect(body.stats.openTickets).toBe(2);
    expect(body.stats.closedTickets).toBe(1);
    expect(body.stats.lastActivityAt).not.toBeNull();
  });

  it("aggregates per-member assignee and reporter counts", async () => {
    const { user: other } = await createExtraUser("Other", "other@test.com");
    await db.insert(projectMembers).values({ projectID, userID: other.id, role: "member" });

    await createTicket(cookies, backlogStatusID, { title: "Self assigned" });
    await createTicket(cookies, backlogStatusID, { title: "Other assigned", assigneeID: other.id });
    await createTicket(cookies, doneStatusID, { title: "Other closed", assigneeID: other.id });

    const res = await app.request("/api/projects/STATS/stats", { method: "GET", headers: { Cookie: cookies } });
    const body = await res.json();

    const reporter = body.stats.byMember[Object.keys(body.stats.byMember).find((id) => id !== other.id)!];
    expect(reporter.reported).toBe(3);
    expect(reporter.assignedOpen).toBe(0);

    const otherStats = body.stats.byMember[other.id];
    expect(otherStats.assignedOpen).toBe(1);
    expect(otherStats.assignedTotal).toBe(2);
    expect(otherStats.reported).toBe(0);
  });

  it("allows non-member reads when the project is public", async () => {
    const { cookies: outsider } = await createExtraUser("Outsider", "outsider@test.com");
    const res = await app.request("/api/projects/STATS/stats", { method: "GET", headers: { Cookie: outsider } });
    expect(res.status).toBe(200);
  });

  it("rejects non-member reads when the project is private", async () => {
    await createProject(cookies, { key: "PRIV", visibility: "private" });
    const { cookies: outsider } = await createExtraUser("Outsider", "outsider@test.com");
    const res = await app.request("/api/projects/PRIV/stats", { method: "GET", headers: { Cookie: outsider } });
    expect(res.status).toBe(404);
  });

  it("allows anonymous reads when the project is public", async () => {
    const res = await app.request("/api/projects/STATS/stats", { method: "GET" });
    expect(res.status).toBe(200);
  });

  it("rejects anonymous reads when the project is private", async () => {
    await createProject(cookies, { key: "PRIV", visibility: "private" });
    const res = await app.request("/api/projects/PRIV/stats", { method: "GET" });
    expect(res.status).toBe(404);
  });

  it("counts only public tickets for non-members", async () => {
    await createTicket(cookies, backlogStatusID, { title: "Public" });
    await createTicket(cookies, backlogStatusID, { title: "Private", visibility: "private" });

    const res = await app.request("/api/projects/STATS/stats");
    const body = await res.json();
    expect(body.stats.totalTickets).toBe(1);
    expect(body.stats.openTickets).toBe(1);
  });

  it("counts all tickets for members", async () => {
    await createTicket(cookies, backlogStatusID, { title: "Public" });
    await createTicket(cookies, backlogStatusID, { title: "Private", visibility: "private" });

    const res = await app.request("/api/projects/STATS/stats", { headers: { Cookie: cookies } });
    const body = await res.json();
    expect(body.stats.totalTickets).toBe(2);
  });
});
