import { describe, it, expect, beforeEach } from "vitest";
import app from "../index";
import { db } from "../db";
import { statuses, projectMembers } from "../db/schema";
import { and, eq, ne } from "drizzle-orm";
import { createAuthenticatedUser, createExtraUser, createProject, resetDatabase } from "./helpers";

let cookies: string;
let projectID: string;

describe("POST /api/projects/:key/statuses", () => {
  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
    const project = await createProject(cookies);
    projectID = project.id;
  });

  it("creates a status", async () => {
    const res = await app.request("/api/projects/TEST/statuses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "Staging", slug: "staging", category: "active" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status.name).toBe("Staging");
    expect(body.status.slug).toBe("staging");
    expect(body.status.category).toBe("active");
    expect(body.status.projectID).toBe(projectID);
  });

  it("auto-positions status at end of category", async () => {
    const res = await app.request("/api/projects/TEST/statuses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "Staging", slug: "staging", category: "active" }),
    });

    const body = await res.json();
    expect(body.status.position).toBeGreaterThan(20);
  });

  it("returns 401 for non-authenticated requests", async () => {
    const res = await app.request("/api/projects/TEST/statuses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Staging", slug: "staging", category: "active" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent project", async () => {
    const res = await app.request("/api/projects/NOPE/statuses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "Staging", slug: "staging", category: "active" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 for non-owner", async () => {
    const { user, cookies: memberCookies } = await createExtraUser("Member", "member@test.com");
    await db.insert(projectMembers).values({ projectID, userID: user.id, role: "member" });

    const res = await app.request("/api/projects/TEST/statuses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: memberCookies },
      body: JSON.stringify({ name: "Staging", slug: "staging", category: "active" }),
    });
    expect(res.status).toBe(403);
  });

  it("rejects missing name", async () => {
    const res = await app.request("/api/projects/TEST/statuses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ slug: "staging", category: "active" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects duplicate slug in same project", async () => {
    await app.request("/api/projects/TEST/statuses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "Staging", slug: "staging", category: "active" }),
    });

    const res = await app.request("/api/projects/TEST/statuses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "Staging V2", slug: "staging", category: "active" }),
    });
    expect(res.status).toBe(409);
  });
});

describe("GET /api/projects/:key/statuses", () => {
  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
    const project = await createProject(cookies);
    projectID = project.id;
  });

  it("returns the 6 seeded default statuses", async () => {
    const res = await app.request("/api/projects/TEST/statuses", { headers: { Cookie: cookies } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.statuses).toHaveLength(6);
    const names = body.statuses.map((s: { name: string }) => s.name).sort();
    expect(names).toEqual(["Backlog", "Cancelled", "Done", "In Progress", "In Review", "Todo"]);
  });

  it("returns statuses ordered by category then position", async () => {
    const res = await app.request("/api/projects/TEST/statuses", { headers: { Cookie: cookies } });

    const body = await res.json();
    const statuses = body.statuses;
    expect(statuses[0].category).toBe("backlog");
    expect(statuses[statuses.length - 1].category).toBe("cancelled");
  });

  it("returns 401 for non-authenticated requests", async () => {
    const res = await app.request("/api/projects/TEST/statuses");
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-member", async () => {
    const { cookies: otherCookies } = await createExtraUser("Other", "other@test.com");
    const res = await app.request("/api/projects/TEST/statuses", { headers: { Cookie: otherCookies } });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/projects/:key/statuses/reorder", () => {
  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
    const project = await createProject(cookies);
    projectID = project.id;
  });

  it("reorders statuses", async () => {
    const res1 = await app.request("/api/projects/TEST/statuses", { headers: { Cookie: cookies } });
    const body1 = await res1.json();
    const activeStatuses = body1.statuses.filter((s: any) => s.category === "active");

    const reorderRes = await app.request("/api/projects/TEST/statuses/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({
        order: [
          { id: activeStatuses[0].id, position: 30 },
          { id: activeStatuses[1].id, position: 10 },
        ],
      }),
    });

    expect(reorderRes.status).toBe(200);
    const reorderBody = await reorderRes.json();
    const updated = reorderBody.statuses.filter((s: any) => s.category === "active");
    expect(updated[0].position).toBeLessThan(updated[1].position);
  });

  it("updates category in reorder", async () => {
    const res1 = await app.request("/api/projects/TEST/statuses", { headers: { Cookie: cookies } });
    const body1 = await res1.json();
    const backlogStatus = body1.statuses.find((s: any) => s.category === "backlog");

    const reorderRes = await app.request("/api/projects/TEST/statuses/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({
        order: [{ id: backlogStatus.id, position: 10, category: "active" }],
      }),
    });

    expect(reorderRes.status).toBe(200);
    const body = await reorderRes.json();
    const moved = body.statuses.find((s: any) => s.id === backlogStatus.id);
    expect(moved.category).toBe("active");
  });

  it("returns 401 for non-authenticated requests", async () => {
    const res = await app.request("/api/projects/TEST/statuses/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: [] }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-owner", async () => {
    const { user, cookies: memberCookies } = await createExtraUser("Member", "member@test.com");
    await db.insert(projectMembers).values({ projectID, userID: user.id, role: "member" });

    const res = await app.request("/api/projects/TEST/statuses/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: memberCookies },
      body: JSON.stringify({ order: [] }),
    });
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/projects/:key/statuses/:id", () => {
  let statusID: string;

  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
    const project = await createProject(cookies);
    projectID = project.id;
    const [seeded] = await db.select().from(statuses).where(eq(statuses.projectID, projectID)).limit(1);
    statusID = seeded.id;
  });

  it("updates status name and slug", async () => {
    const res = await app.request(`/api/projects/TEST/statuses/${statusID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "Renamed", slug: "renamed" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status.name).toBe("Renamed");
    expect(body.status.slug).toBe("renamed");
  });

  it("auto-derives slug from name when slug is omitted", async () => {
    const res = await app.request(`/api/projects/TEST/statuses/${statusID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "Renamed" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status.name).toBe("Renamed");
    expect(body.status.slug).toBe("renamed");
  });

  it("returns 401 for non-authenticated requests", async () => {
    const res = await app.request(`/api/projects/TEST/statuses/${statusID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Renamed" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent status", async () => {
    const fakeID = "00000000-0000-0000-0000-000000000000";
    const res = await app.request(`/api/projects/TEST/statuses/${fakeID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "Renamed" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid status UUID", async () => {
    const res = await app.request(`/api/projects/TEST/statuses/not-a-uuid`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "Renamed" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 403 for non-owner", async () => {
    const { user, cookies: memberCookies } = await createExtraUser("Member", "member@test.com");
    await db.insert(projectMembers).values({ projectID, userID: user.id, role: "member" });

    const res = await app.request(`/api/projects/TEST/statuses/${statusID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: memberCookies },
      body: JSON.stringify({ name: "Renamed" }),
    });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/projects/:key/statuses/:id", () => {
  let statusID: string;

  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
    const project = await createProject(cookies);
    projectID = project.id;
    const [seeded] = await db.select().from(statuses).where(eq(statuses.projectID, projectID)).limit(1);
    statusID = seeded.id;
  });

  it("deletes a status and reassigns to another", async () => {
    const [otherStatus] = await db
      .select()
      .from(statuses)
      .where(and(eq(statuses.projectID, projectID), ne(statuses.id, statusID)))
      .limit(1);

    const res = await app.request(`/api/projects/TEST/statuses/${statusID}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ reassignTo: otherStatus.id }),
    });

    expect(res.status).toBe(204);
    const rows = await db.select().from(statuses).where(eq(statuses.id, statusID));
    expect(rows).toHaveLength(0);
  });

  it("returns 409 when deleting last status", async () => {
    const allStatuses = await db.select().from(statuses).where(eq(statuses.projectID, projectID));
    const lastStatusID = allStatuses[0].id;

    for (const status of allStatuses.slice(1)) {
      await app.request(`/api/projects/TEST/statuses/${status.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Cookie: cookies },
        body: JSON.stringify({ reassignTo: lastStatusID }),
      });
    }

    const res = await app.request(`/api/projects/TEST/statuses/${lastStatusID}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ reassignTo: lastStatusID }),
    });

    expect(res.status).toBe(409);
  });

  it("returns 401 for non-authenticated requests", async () => {
    const res = await app.request(`/api/projects/TEST/statuses/${statusID}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reassignTo: statusID }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent status", async () => {
    const fakeID = "00000000-0000-0000-0000-000000000000";
    const res = await app.request(`/api/projects/TEST/statuses/${fakeID}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ reassignTo: fakeID }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid status UUID", async () => {
    const res = await app.request(`/api/projects/TEST/statuses/not-a-uuid`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ reassignTo: statusID }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 403 for non-owner", async () => {
    const { user, cookies: memberCookies } = await createExtraUser("Member", "member@test.com");
    await db.insert(projectMembers).values({ projectID, userID: user.id, role: "member" });

    const [otherStatus] = await db
      .select()
      .from(statuses)
      .where(and(eq(statuses.projectID, projectID), ne(statuses.id, statusID)))
      .limit(1);

    const res = await app.request(`/api/projects/TEST/statuses/${statusID}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Cookie: memberCookies },
      body: JSON.stringify({ reassignTo: otherStatus.id }),
    });
    expect(res.status).toBe(403);
  });
});
