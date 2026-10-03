import { describe, it, expect, beforeEach } from "vitest";
import app from "../index";
import { db } from "../db";
import { labels, projectMembers } from "../db/schema";
import { eq } from "drizzle-orm";
import { createAuthenticatedUser, createExtraUser, createProject, resetDatabase } from "./helpers";

let cookies: string;
let projectID: string;

describe("POST /api/projects/:key/labels", () => {
  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
    const project = await createProject(cookies);
    projectID = project.id;
  });

  it("creates a label", async () => {
    const res = await app.request("/api/projects/TEST/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "Critical", colour: "#ff0000" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.label.name).toBe("Critical");
    expect(body.label.colour).toBe("#ff0000");
    expect(body.label.projectID).toBe(projectID);
  });

  it("returns 401 for non-authenticated requests", async () => {
    const res = await app.request("/api/projects/TEST/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Critical", colour: "#ff0000" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent project", async () => {
    const res = await app.request("/api/projects/NOPE/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "Critical", colour: "#ff0000" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 for non-member", async () => {
    const { cookies: otherCookies } = await createExtraUser("Other", "other@test.com");
    const res = await app.request("/api/projects/TEST/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: otherCookies },
      body: JSON.stringify({ name: "Critical", colour: "#ff0000" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 for member who is not owner", async () => {
    const { user, cookies: memberCookies } = await createExtraUser("Member", "member@test.com");
    await db.insert(projectMembers).values({ projectID, userID: user.id, role: "member" });

    const res = await app.request("/api/projects/TEST/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: memberCookies },
      body: JSON.stringify({ name: "Critical", colour: "#ff0000" }),
    });
    expect(res.status).toBe(403);
  });

  it("rejects invalid colour format", async () => {
    const res = await app.request("/api/projects/TEST/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "Critical", colour: "red" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects missing name", async () => {
    const res = await app.request("/api/projects/TEST/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ colour: "#ff0000" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects duplicate label name on same project", async () => {
    await app.request("/api/projects/TEST/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "Critical", colour: "#ff0000" }),
    });

    const res = await app.request("/api/projects/TEST/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "Critical", colour: "#00ff00" }),
    });
    expect(res.status).toBe(500);
  });
});

describe("GET /api/projects/:key/labels", () => {
  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
    const project = await createProject(cookies);
    projectID = project.id;
  });

  it("returns the 5 seeded default labels", async () => {
    const res = await app.request("/api/projects/TEST/labels", { headers: { Cookie: cookies } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.labels).toHaveLength(5);
    const names = body.labels.map((l: { name: string }) => l.name).sort();
    expect(names).toEqual(["Bug", "Chore", "Feature", "Improvement", "Task"]);
  });

  it("returns 401 for non-authenticated requests", async () => {
    const res = await app.request("/api/projects/TEST/labels");
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-member", async () => {
    const { cookies: otherCookies } = await createExtraUser("Other", "other@test.com");
    const res = await app.request("/api/projects/TEST/labels", { headers: { Cookie: otherCookies } });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/projects/:key/labels/:id", () => {
  let labelID: string;

  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
    const project = await createProject(cookies);
    projectID = project.id;
    const [seeded] = await db.select().from(labels).where(eq(labels.projectID, projectID)).limit(1);
    labelID = seeded.id;
  });

  it("updates label name and colour", async () => {
    const res = await app.request(`/api/projects/TEST/labels/${labelID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "Renamed", colour: "#123456" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.label.name).toBe("Renamed");
    expect(body.label.colour).toBe("#123456");
  });

  it("returns 401 for non-authenticated requests", async () => {
    const res = await app.request(`/api/projects/TEST/labels/${labelID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Renamed", colour: "#123456" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent label", async () => {
    const fakeID = "00000000-0000-0000-0000-000000000000";
    const res = await app.request(`/api/projects/TEST/labels/${fakeID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "Renamed", colour: "#123456" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when label belongs to a different project", async () => {
    await createProject(cookies, { key: "OTHER", name: "Other" });

    const res = await app.request(`/api/projects/OTHER/labels/${labelID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "Renamed", colour: "#123456" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid colour", async () => {
    const res = await app.request(`/api/projects/TEST/labels/${labelID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "Renamed", colour: "blue" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid label UUID", async () => {
    const res = await app.request(`/api/projects/TEST/labels/not-a-uuid`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "Renamed", colour: "#123456" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-member", async () => {
    const { cookies: otherCookies } = await createExtraUser("Other", "other@test.com");
    const res = await app.request(`/api/projects/TEST/labels/${labelID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: otherCookies },
      body: JSON.stringify({ name: "Renamed", colour: "#123456" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 for member who is not owner", async () => {
    const { user, cookies: memberCookies } = await createExtraUser("Member", "member@test.com");
    await db.insert(projectMembers).values({ projectID, userID: user.id, role: "member" });

    const res = await app.request(`/api/projects/TEST/labels/${labelID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: memberCookies },
      body: JSON.stringify({ name: "Renamed", colour: "#123456" }),
    });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/projects/:key/labels/:id", () => {
  let labelID: string;

  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
    const project = await createProject(cookies);
    projectID = project.id;
    const [seeded] = await db.select().from(labels).where(eq(labels.projectID, projectID)).limit(1);
    labelID = seeded.id;
  });

  it("deletes a label", async () => {
    const res = await app.request(`/api/projects/TEST/labels/${labelID}`, {
      method: "DELETE",
      headers: { Cookie: cookies },
    });

    expect(res.status).toBe(204);
    const rows = await db.select().from(labels).where(eq(labels.id, labelID));
    expect(rows).toHaveLength(0);
  });

  it("returns 401 for non-authenticated requests", async () => {
    const res = await app.request(`/api/projects/TEST/labels/${labelID}`, { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent label", async () => {
    const fakeID = "00000000-0000-0000-0000-000000000000";
    const res = await app.request(`/api/projects/TEST/labels/${fakeID}`, {
      method: "DELETE",
      headers: { Cookie: cookies },
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when label belongs to a different project", async () => {
    await createProject(cookies, { key: "OTHER", name: "Other" });

    const res = await app.request(`/api/projects/OTHER/labels/${labelID}`, {
      method: "DELETE",
      headers: { Cookie: cookies },
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid label UUID", async () => {
    const res = await app.request(`/api/projects/TEST/labels/not-a-uuid`, {
      method: "DELETE",
      headers: { Cookie: cookies },
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-member", async () => {
    const { cookies: otherCookies } = await createExtraUser("Other", "other@test.com");
    const res = await app.request(`/api/projects/TEST/labels/${labelID}`, {
      method: "DELETE",
      headers: { Cookie: otherCookies },
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 for member who is not owner", async () => {
    const { user, cookies: memberCookies } = await createExtraUser("Member", "member@test.com");
    await db.insert(projectMembers).values({ projectID, userID: user.id, role: "member" });

    const res = await app.request(`/api/projects/TEST/labels/${labelID}`, {
      method: "DELETE",
      headers: { Cookie: memberCookies },
    });
    expect(res.status).toBe(403);
  });
});
