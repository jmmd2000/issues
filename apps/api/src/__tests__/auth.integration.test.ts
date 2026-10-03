import { describe, it, expect, beforeEach } from "vitest";
import app from "../index";
import { db } from "../db";
import { sessions, users } from "../db/schema";
import { eq } from "drizzle-orm";
import argon2 from "argon2";
import { createAuthenticatedUser, resetDatabase } from "./helpers";

describe("POST /api/auth/register", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creates user when none exist", async () => {
    const res = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "James", email: "j@example.com", password: "password123" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.email).toBe("j@example.com");
    expect(body.user).not.toHaveProperty("passwordHash");
  });

  it("returns 403 when a user already exists", async () => {
    await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "James", email: "j@example.com", password: "password123" }),
    });

    const res = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bob", email: "b@example.com", password: "password123" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid email", async () => {
    const res = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "James", email: "not-an-email", password: "password123" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for too short password", async () => {
    const res = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "James", email: "j@example.com", password: "short" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await resetDatabase();
    await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "James", email: "j@example.com", password: "password123" }),
    });
  });

  it("returns 200 and sets a session cookie on valid credentials", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "j@example.com", password: "password123" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("session_id=");
  });

  it("returns 401 for wrong password", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "j@example.com", password: "wrongpassword" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 for non-existent email", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nobody@example.com", password: "password123" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid email format", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-email", password: "password123" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/logout", () => {
  let sessionCookie: string;

  beforeEach(async () => {
    await resetDatabase();
    ({ cookies: sessionCookie } = await createAuthenticatedUser());
  });

  it("clears the session cookie", async () => {
    const res = await app.request("/api/auth/logout", {
      method: "POST",
      headers: { Cookie: sessionCookie },
    });
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("session_id=");
    expect(setCookie).toContain("Max-Age=0");
  });

  it("deletes the session from the db", async () => {
    await app.request("/api/auth/logout", {
      method: "POST",
      headers: { Cookie: sessionCookie },
    });
    const remaining = await db.select().from(sessions);
    expect(remaining).toHaveLength(0);
  });
});

describe("GET /api/auth/me", () => {
  let sessionCookie: string;

  beforeEach(async () => {
    await resetDatabase();
    ({ cookies: sessionCookie } = await createAuthenticatedUser());
  });

  it("returns the user based on the sessionID", async () => {
    const res = await app.request("/api/auth/me", {
      method: "GET",
      headers: { Cookie: sessionCookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe("test@test.com");
    expect(body.user.name).toBe("Test User");
    expect(body.user).not.toHaveProperty("passwordHash");
  });

  it("returns 401 if the user could not be found", async () => {
    await db.delete(sessions);

    const res = await app.request("/api/auth/me", {
      method: "GET",
      headers: { Cookie: sessionCookie },
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 with no session cookie", async () => {
    const res = await app.request("/api/auth/me", { method: "GET" });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/change-password", () => {
  let sessionCookie: string;

  beforeEach(async () => {
    await resetDatabase();
    ({ cookies: sessionCookie } = await createAuthenticatedUser());
  });

  it("changes the password when the current one is correct", async () => {
    const res = await app.request("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({ currentPassword: "password123", newPassword: "newpassword456" }),
    });

    expect(res.status).toBe(200);

    const [stored] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.email, "test@test.com")).limit(1);
    expect(await argon2.verify(stored.passwordHash, "newpassword456")).toBe(true);
  });

  it("rotates the session and issues a fresh cookie", async () => {
    const before = await db.select({ id: sessions.id }).from(sessions);

    const res = await app.request("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({ currentPassword: "password123", newPassword: "newpassword456" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("session_id=");

    const after = await db.select({ id: sessions.id }).from(sessions);
    expect(after).toHaveLength(1);
    expect(after[0].id).not.toBe(before[0].id);
  });

  it("returns 401 when the current password is wrong", async () => {
    const res = await app.request("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({ currentPassword: "wrongpassword", newPassword: "newpassword456" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 with no session cookie", async () => {
    const res = await app.request("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: "password123", newPassword: "newpassword456" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 for too short new password", async () => {
    const res = await app.request("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({ currentPassword: "password123", newPassword: "short" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/auth/registration-status", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returns true if max users hasn't been reached", async () => {
    const res = await app.request("/api/auth/registration-status", {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.open).toBe(true);
  });

  it("returns false if max users has been reached", async () => {
    await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "James", email: "j@example.com", password: "password123" }),
    });

    const res = await app.request("/api/auth/registration-status", {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.open).toBe(false);
  });
});
