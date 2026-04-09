import { describe, it, expect, beforeEach } from "vitest";
import app from "../index";
import { db } from "../db";
import { labels, projectMembers, statuses } from "../db/schema";
import { eq } from "drizzle-orm";
import { createAuthenticatedUser, resetDatabase } from "./helpers";

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
});
