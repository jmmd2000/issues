import { describe, it, expect, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import app from "../index";
import { db } from "../db";
import { apiTokens } from "../db/schema";
import { createAuthenticatedUser, createExtraUser, createTokenForUser, resetDatabase } from "./helpers";

const RAW_TOKEN_HEX = /^[a-f0-9]{64}$/;

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

describe("POST /api/auth/tokens", () => {
  let cookies: string;

  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
  });

  it("creates a token and returns the raw value and persisted record", async () => {
    const res = await app.request("/api/auth/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "CLI" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.token).toMatch(RAW_TOKEN_HEX);
    expect(body.apiToken).toMatchObject({ name: "CLI", lastUsedAt: null });
    expect(body.apiToken).not.toHaveProperty("tokenHash");
    expect(body.apiToken).not.toHaveProperty("userID");
  });

  it("stores only the SHA-256 hash, never the raw token", async () => {
    const res = await app.request("/api/auth/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "CLI" }),
    });
    const { token } = await res.json();

    const rows = await db.select().from(apiTokens);
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(rows[0].tokenHash).not.toBe(token);
  });

  it("defaults expiresInDays to 90 when omitted", async () => {
    const res = await app.request("/api/auth/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "CLI" }),
    });

    const body = await res.json();
    const expectedExpiry = Date.now() + 1000 * 60 * 60 * 24 * 90;
    const actualExpiry = new Date(body.apiToken.expiresAt).getTime();
    expect(Math.abs(actualExpiry - expectedExpiry)).toBeLessThan(5000);
  });

  it("returns 400 for empty name", async () => {
    const res = await app.request("/api/auth/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "   " }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for name longer than 80 chars", async () => {
    const res = await app.request("/api/auth/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "a".repeat(81) }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for expiresInDays below 1", async () => {
    const res = await app.request("/api/auth/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "CLI", expiresInDays: 0 }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for expiresInDays above 365", async () => {
    const res = await app.request("/api/auth/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ name: "CLI", expiresInDays: 366 }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 401 without authentication", async () => {
    const res = await app.request("/api/auth/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "CLI" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/tokens", () => {
  let cookies: string;
  let userID: string;

  beforeEach(async () => {
    await resetDatabase();
    const auth = await createAuthenticatedUser();
    cookies = auth.cookies;
    userID = auth.user.id;
  });

  it("lists the user's tokens newest first", async () => {
    await createTokenForUser(userID, { name: "First" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await createTokenForUser(userID, { name: "Second" });

    const res = await app.request("/api/auth/tokens", { method: "GET", headers: { Cookie: cookies } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.apiTokens.map((t: { name: string }) => t.name)).toEqual(["Second", "First"]);
  });

  it("never includes tokenHash in listed tokens", async () => {
    await createTokenForUser(userID);
    const res = await app.request("/api/auth/tokens", { method: "GET", headers: { Cookie: cookies } });
    const body = await res.json();
    expect(body.apiTokens[0]).not.toHaveProperty("tokenHash");
    expect(body.apiTokens[0]).not.toHaveProperty("userID");
  });

  it("excludes tokens owned by other users", async () => {
    await createTokenForUser(userID, { name: "Mine" });
    const other = await createExtraUser("Other", "other@test.com");
    await createTokenForUser(other.user.id, { name: "Theirs" });

    const res = await app.request("/api/auth/tokens", { method: "GET", headers: { Cookie: cookies } });
    const body = await res.json();
    expect(body.apiTokens).toHaveLength(1);
    expect(body.apiTokens[0].name).toBe("Mine");
  });

  it("returns 401 without authentication", async () => {
    const res = await app.request("/api/auth/tokens", { method: "GET" });
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/auth/tokens/:id", () => {
  let cookies: string;
  let userID: string;

  beforeEach(async () => {
    await resetDatabase();
    const auth = await createAuthenticatedUser();
    cookies = auth.cookies;
    userID = auth.user.id;
  });

  it("revokes the token and removes it from the database", async () => {
    const { record } = await createTokenForUser(userID);
    const res = await app.request(`/api/auth/tokens/${record.id}`, { method: "DELETE", headers: { Cookie: cookies } });

    expect(res.status).toBe(204);
    const remaining = await db.select().from(apiTokens).where(eq(apiTokens.id, record.id));
    expect(remaining).toHaveLength(0);
  });

  it("returns 404 when the token id does not exist", async () => {
    const res = await app.request("/api/auth/tokens/00000000-0000-0000-0000-000000000000", { method: "DELETE", headers: { Cookie: cookies } });
    expect(res.status).toBe(404);
  });

  it("returns 404 when the token belongs to another user", async () => {
    const other = await createExtraUser("Other", "other@test.com");
    const { record } = await createTokenForUser(other.user.id);

    const res = await app.request(`/api/auth/tokens/${record.id}`, { method: "DELETE", headers: { Cookie: cookies } });
    expect(res.status).toBe(404);
  });

  it("returns 400 when the id is not a UUID", async () => {
    const res = await app.request("/api/auth/tokens/not-a-uuid", { method: "DELETE", headers: { Cookie: cookies } });
    expect(res.status).toBe(400);
  });

  it("returns 401 without authentication", async () => {
    const { record } = await createTokenForUser(userID);
    const res = await app.request(`/api/auth/tokens/${record.id}`, { method: "DELETE" });
    expect(res.status).toBe(401);
  });
});

describe("bearer auth on requireAuth", () => {
  let cookies: string;
  let userID: string;

  beforeEach(async () => {
    await resetDatabase();
    const auth = await createAuthenticatedUser();
    cookies = auth.cookies;
    userID = auth.user.id;
  });

  it("accepts a valid bearer token", async () => {
    const { token } = await createTokenForUser(userID);
    const res = await app.request("/api/auth/tokens", { method: "GET", headers: bearer(token) });
    expect(res.status).toBe(200);
  });

  it("returns 401 for a malformed bearer (wrong length)", async () => {
    const res = await app.request("/api/auth/tokens", { method: "GET", headers: bearer("tooshort") });
    expect(res.status).toBe(401);
  });

  it("returns 401 for a malformed bearer (non-hex)", async () => {
    const res = await app.request("/api/auth/tokens", { method: "GET", headers: bearer("z".repeat(64)) });
    expect(res.status).toBe(401);
  });

  it("returns 401 for an unknown bearer", async () => {
    const res = await app.request("/api/auth/tokens", { method: "GET", headers: bearer("0".repeat(64)) });
    expect(res.status).toBe(401);
  });

  it("returns 401 for an expired bearer", async () => {
    const { token } = await createTokenForUser(userID, { expiresAt: new Date(Date.now() - 1000) });
    const res = await app.request("/api/auth/tokens", { method: "GET", headers: bearer(token) });
    expect(res.status).toBe(401);
  });

  it("returns 401 for a revoked bearer", async () => {
    const { token, record } = await createTokenForUser(userID);
    await db.delete(apiTokens).where(eq(apiTokens.id, record.id));

    const res = await app.request("/api/auth/tokens", { method: "GET", headers: bearer(token) });
    expect(res.status).toBe(401);
  });

  it("uses the session cookie when both cookie and bearer are provided", async () => {
    const { token, record } = await createTokenForUser(userID);
    // Wipe the bearer so we know the request only succeeds if the cookie is consulted.
    await db.delete(apiTokens).where(eq(apiTokens.id, record.id));

    const res = await app.request("/api/auth/tokens", { method: "GET", headers: { Cookie: cookies, ...bearer(token) } });
    expect(res.status).toBe(200);
  });

  it("updates lastUsedAt on a successful bearer request", async () => {
    const { token, record } = await createTokenForUser(userID);
    expect(record.lastUsedAt).toBeNull();

    const res = await app.request("/api/auth/tokens", { method: "GET", headers: bearer(token) });
    expect(res.status).toBe(200);

    const [row] = await db.select().from(apiTokens).where(eq(apiTokens.id, record.id));
    expect(row.lastUsedAt).not.toBeNull();
  });
});
