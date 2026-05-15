import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import app from "../index";
import { db } from "../db";
import { users } from "../db/schema";
import { createAuthenticatedUser, createProject, createServiceUser, createTokenForUser, resetDatabase } from "./helpers";

const RAW_TOKEN_HEX = /^[a-f0-9]{64}$/;

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

describe("POST /api/users/service", () => {
  let cookies: string;

  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
  });

  it("creates a service user with is_service true", async () => {
    const res = await app.request("/api/users/service", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "Claude" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user).toMatchObject({ name: "Claude", isService: true });
    expect(body.user.id).toBeTruthy();
    expect(body.user).not.toHaveProperty("passwordHash");

    const [row] = await db.select().from(users).where(eq(users.id, body.user.id)).limit(1);
    expect(row.isService).toBe(true);
  });

  it("rejects callers who are themselves service users", async () => {
    const { user } = await createServiceUser("Bot");
    const { token } = await createTokenForUser(user.id);

    const res = await app.request("/api/users/service", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...bearer(token) },
      body: JSON.stringify({ name: "Another" }),
    });

    expect(res.status).toBe(403);
  });

  it("requires an authenticated caller", async () => {
    const res = await app.request("/api/users/service", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Claude" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/users/service", () => {
  let cookies: string;

  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
  });

  it("returns only service users, oldest first", async () => {
    await createServiceUser("Alpha", "alpha@service.local");
    await createServiceUser("Beta", "beta@service.local");

    const res = await app.request("/api/users/service", { method: "GET", headers: { Cookie: cookies } });
    expect(res.status).toBe(200);

    const body = await res.json();
    const names = body.serviceUsers.map((user: { name: string }) => user.name);
    expect(names).toEqual(["Alpha", "Beta"]);
  });
});

describe("Service user tokens", () => {
  let cookies: string;
  let serviceUserID: string;

  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
    const { user } = await createServiceUser("Claude");
    serviceUserID = user.id;
  });

  it("mints a token on behalf of the service user", async () => {
    const res = await app.request(`/api/users/service/${serviceUserID}/tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "MCP local" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.token).toMatch(RAW_TOKEN_HEX);
    expect(body.apiToken).toMatchObject({ name: "MCP local", lastUsedAt: null });
  });

  it("lists tokens for the service user", async () => {
    await createTokenForUser(serviceUserID, { name: "MCP" });

    const res = await app.request(`/api/users/service/${serviceUserID}/tokens`, { method: "GET", headers: { Cookie: cookies } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.apiTokens).toHaveLength(1);
    expect(body.apiTokens[0]).toMatchObject({ name: "MCP" });
  });

  it("revokes a token", async () => {
    const { record } = await createTokenForUser(serviceUserID, { name: "MCP" });

    const res = await app.request(`/api/users/service/${serviceUserID}/tokens/${record.id}`, {
      method: "DELETE",
      headers: { Cookie: cookies },
    });
    expect(res.status).toBe(204);
  });
});

describe("Registration count ignores service users", () => {
  beforeEach(resetDatabase);

  it("checkRegistrationStatus reports open when only service users exist", async () => {
    await createServiceUser("Claude");
    const res = await app.request("/api/auth/registration-status");
    const body = await res.json();
    expect(body.open).toBe(true);
  });

  it("first human can still register after a service user exists", async () => {
    await createServiceUser("Claude");
    const res = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Human", email: "human@test.com", password: "password123" }),
    });
    expect(res.status).toBe(201);
  });
});

describe("Service user access", () => {
  let humanCookies: string;
  let serviceUserToken: string;

  beforeEach(async () => {
    await resetDatabase();
    ({ cookies: humanCookies } = await createAuthenticatedUser());
    const { user } = await createServiceUser("Claude");
    serviceUserToken = (await createTokenForUser(user.id)).token;
  });

  it("sees every project including private ones via MCP", async () => {
    await createProject(humanCookies, { key: "PUB", visibility: "public" });
    await createProject(humanCookies, { key: "PRIV", visibility: "private" });

    const res = await app.request("/api/mcp/projects", { method: "GET", headers: bearer(serviceUserToken) });
    expect(res.status).toBe(200);
    const body = await res.json();
    const keys = body.projects.map((project: { key: string }) => project.key).sort();
    expect(keys).toEqual(["PRIV", "PUB"]);
  });

  it("can create a ticket in a private project they aren't a member of", async () => {
    await createProject(humanCookies, { key: "PRIV", visibility: "private" });

    const res = await app.request("/api/mcp/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...bearer(serviceUserToken) },
      body: JSON.stringify({ project: "PRIV", title: "From service user" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ticket).toMatchObject({ title: "From service user" });
  });
});

describe("Service users absent from member views", () => {
  let humanCookies: string;

  beforeEach(async () => {
    await resetDatabase();
    ({ cookies: humanCookies } = await createAuthenticatedUser());
    await createServiceUser("Claude");
  });

  it("does not appear in /api/projects/:key members", async () => {
    await createProject(humanCookies, { key: "VIS" });

    const res = await app.request("/api/projects/VIS", { method: "GET", headers: { Cookie: humanCookies } });
    expect(res.status).toBe(200);
    const body = await res.json();
    const memberNames = body.project.members.map((member: { user: { name: string } }) => member.user.name);
    expect(memberNames).not.toContain("Claude");
  });

  it("does not appear in /api/search/filters assignees", async () => {
    await createProject(humanCookies, { key: "VIS" });

    const res = await app.request("/api/search/filters", { method: "GET", headers: { Cookie: humanCookies } });
    expect(res.status).toBe(200);
    const body = await res.json();
    const assigneeNames = body.filters.assignees.map((assignee: { name: string }) => assignee.name);
    expect(assigneeNames).not.toContain("Claude");
  });
});
