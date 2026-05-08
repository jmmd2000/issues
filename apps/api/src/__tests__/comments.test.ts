import { describe, it, expect, beforeEach } from "vitest";
import app from "../index";
import { db } from "../db";
import { comments, projectMembers, statuses, ticketActivity } from "../db/schema";
import { and, eq } from "drizzle-orm";
import { createAuthenticatedUser, createExtraUser, createProject, resetDatabase } from "./helpers";

let cookies: string;
let projectID: string;
let statusID: string;
let ticketID: string;
let ticketNumber: number;

async function seedStatusID(): Promise<string> {
  const [row] = await db.select({ id: statuses.id }).from(statuses).where(eq(statuses.projectID, projectID)).limit(1);
  return row.id;
}

async function createTicket(authCookies = cookies, overrides: Partial<{ title: string }> = {}) {
  const res = await app.request("/api/projects/TEST/tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: authCookies },
    body: JSON.stringify({ title: "Ticket", statusID, ...overrides }),
  });
  const body = await res.json();
  return body.ticket;
}

async function postComment(authCookies = cookies, body = "Hello there", num = ticketNumber) {
  return app.request(`/api/projects/TEST/tickets/${num}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: authCookies },
    body: JSON.stringify({ body }),
  });
}

async function setupFixture() {
  await resetDatabase();
  ({ cookies } = await createAuthenticatedUser());
  const project = await createProject(cookies);
  projectID = project.id;
  statusID = await seedStatusID();
  const ticket = await createTicket();
  ticketID = ticket.id;
  ticketNumber = ticket.number;
}

describe("POST /api/projects/:key/tickets/:num/comments", () => {
  beforeEach(setupFixture);

  it("creates a comment", async () => {
    const res = await postComment(cookies, "First comment");
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.comment.body).toBe("First comment");
    expect(body.comment.ticketID).toBe(ticketID);
    expect(body.comment.author.name).toBe("Test User");
    expect(body.comment.editedAt).toBeNull();
    expect(body.comment.isDeleted).toBe(false);
  });

  it("writes a comment_added activity row with excerpt", async () => {
    const res = await postComment(cookies, "Activity me");
    const { comment } = await res.json();

    const rows = await db
      .select()
      .from(ticketActivity)
      .where(and(eq(ticketActivity.ticketID, ticketID), eq(ticketActivity.action, "comment_added")));
    expect(rows).toHaveLength(1);
    expect(rows[0].newValue).toEqual({ id: comment.id, excerpt: "Activity me" });
  });

  it("collapses whitespace and truncates long bodies in the activity excerpt", async () => {
    const long = "word ".repeat(100).trim();
    const res = await postComment(cookies, long);
    const { comment } = await res.json();

    const [row] = await db
      .select()
      .from(ticketActivity)
      .where(and(eq(ticketActivity.ticketID, ticketID), eq(ticketActivity.action, "comment_added")));
    const excerpt = (row.newValue as { excerpt: string }).excerpt;
    expect(excerpt.endsWith("...")).toBe(true);
    expect(excerpt.length).toBeLessThanOrEqual(203);
    expect(comment.body).toBe(long);
  });

  it("rejects empty bodies", async () => {
    const res = await postComment(cookies, "   ");
    expect(res.status).toBe(400);
  });

  it("rejects unauthenticated requests", async () => {
    const res = await app.request(`/api/projects/TEST/tickets/${ticketNumber}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "anon" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects non-members with 404", async () => {
    const { cookies: outsider } = await createExtraUser("Outsider", "outsider@test.com");
    const res = await postComment(outsider, "Sneaky");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/projects/:key/tickets/:num/comments", () => {
  beforeEach(setupFixture);

  it("returns comments in chronological order", async () => {
    await postComment(cookies, "First");
    await new Promise((resolve) => setTimeout(resolve, 5));
    await postComment(cookies, "Second");

    const res = await app.request(`/api/projects/TEST/tickets/${ticketNumber}/comments`, {
      method: "GET",
      headers: { Cookie: cookies },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.comments).toHaveLength(2);
    expect(body.comments[0].body).toBe("First");
    expect(body.comments[1].body).toBe("Second");
  });

  it("returns soft-deleted comments as tombstones", async () => {
    const create = await postComment(cookies, "Doomed");
    const { comment } = await create.json();

    await app.request(`/api/projects/TEST/tickets/${ticketNumber}/comments/${comment.id}`, {
      method: "DELETE",
      headers: { Cookie: cookies },
    });

    const res = await app.request(`/api/projects/TEST/tickets/${ticketNumber}/comments`, {
      method: "GET",
      headers: { Cookie: cookies },
    });
    const body = await res.json();
    expect(body.comments).toHaveLength(1);
    expect(body.comments[0].isDeleted).toBe(true);
    expect(body.comments[0].body).toBeNull();
  });
});

describe("PATCH /api/projects/:key/tickets/:num/comments/:id", () => {
  beforeEach(setupFixture);

  it("edits the body and stamps editedAt", async () => {
    const create = await postComment(cookies, "Original");
    const { comment } = await create.json();

    const res = await app.request(`/api/projects/TEST/tickets/${ticketNumber}/comments/${comment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ body: "Updated" }),
    });
    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.comment.body).toBe("Updated");
    expect(updated.comment.editedAt).not.toBeNull();
  });

  it("writes a comment_edited activity row with full bodies", async () => {
    const create = await postComment(cookies, "Original");
    const { comment } = await create.json();

    await app.request(`/api/projects/TEST/tickets/${ticketNumber}/comments/${comment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ body: "Updated" }),
    });

    const rows = await db
      .select()
      .from(ticketActivity)
      .where(and(eq(ticketActivity.ticketID, ticketID), eq(ticketActivity.action, "comment_edited")));
    expect(rows).toHaveLength(1);
    expect(rows[0].oldValue).toEqual({ body: "Original" });
    expect(rows[0].newValue).toEqual({ body: "Updated" });
  });

  it("rejects edits from non-author with 403", async () => {
    const create = await postComment(cookies, "Mine");
    const { comment } = await create.json();

    // Add a second member to the project so the other user is a member but not the author.
    const { user: outsider, cookies: outsiderCookies } = await createExtraUser("Outsider", "outsider@test.com");
    await db.insert(projectMembers).values({ projectID, userID: outsider.id, role: "member" });

    const res = await app.request(`/api/projects/TEST/tickets/${ticketNumber}/comments/${comment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: outsiderCookies },
      body: JSON.stringify({ body: "Hijack" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 for missing comment", async () => {
    const res = await app.request(`/api/projects/TEST/tickets/${ticketNumber}/comments/00000000-0000-0000-0000-000000000000`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ body: "Updated" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/projects/:key/tickets/:num/comments/:id", () => {
  beforeEach(setupFixture);

  it("soft-deletes the comment", async () => {
    const create = await postComment(cookies, "Delete me");
    const { comment } = await create.json();

    const res = await app.request(`/api/projects/TEST/tickets/${ticketNumber}/comments/${comment.id}`, {
      method: "DELETE",
      headers: { Cookie: cookies },
    });
    expect(res.status).toBe(204);

    const [row] = await db.select().from(comments).where(eq(comments.id, comment.id));
    expect(row).toBeDefined();
    expect(row.deletedAt).not.toBeNull();
  });

  it("writes a comment_deleted activity row", async () => {
    const create = await postComment(cookies, "Delete me");
    const { comment } = await create.json();

    await app.request(`/api/projects/TEST/tickets/${ticketNumber}/comments/${comment.id}`, {
      method: "DELETE",
      headers: { Cookie: cookies },
    });

    const rows = await db
      .select()
      .from(ticketActivity)
      .where(and(eq(ticketActivity.ticketID, ticketID), eq(ticketActivity.action, "comment_deleted")));
    expect(rows).toHaveLength(1);
    expect(rows[0].oldValue).toEqual({ id: comment.id, excerpt: "Delete me" });
  });

  it("rejects deletes from non-author with 403", async () => {
    const create = await postComment(cookies, "Mine");
    const { comment } = await create.json();

    const { user: outsider, cookies: outsiderCookies } = await createExtraUser("Outsider", "outsider@test.com");
    await db.insert(projectMembers).values({ projectID, userID: outsider.id, role: "member" });

    const res = await app.request(`/api/projects/TEST/tickets/${ticketNumber}/comments/${comment.id}`, {
      method: "DELETE",
      headers: { Cookie: outsiderCookies },
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 when called twice", async () => {
    const create = await postComment(cookies, "Once");
    const { comment } = await create.json();

    await app.request(`/api/projects/TEST/tickets/${ticketNumber}/comments/${comment.id}`, {
      method: "DELETE",
      headers: { Cookie: cookies },
    });

    const res = await app.request(`/api/projects/TEST/tickets/${ticketNumber}/comments/${comment.id}`, {
      method: "DELETE",
      headers: { Cookie: cookies },
    });
    expect(res.status).toBe(404);
  });
});
