import { describe, it, expect, beforeEach } from "vitest";
import app from "../index";
import { db } from "../db";
import { users } from "../db/schema";

beforeEach(async () => {
  await db.delete(users);
});

describe("POST /api/auth/register", () => {
  it("creates user when none exist", async () => {
    const res = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "James", email: "j@example.com", password: "password123" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user[0].email).toBe("j@example.com");
    expect(body.user[0]).not.toHaveProperty("passwordHash");
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
