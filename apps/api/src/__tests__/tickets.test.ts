import { describe, it, expect, beforeEach } from "vitest";
import app from "../index";
import { db } from "../db";
import { labels, statuses, ticketActivity, ticketLabels, tickets } from "../db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { createAuthenticatedUser, createExtraUser, createProject, resetDatabase } from "./helpers";

let cookies: string;
let projectID: string;
let statusID: string;

async function seedStatusID(): Promise<string> {
  const [row] = await db.select({ id: statuses.id }).from(statuses).where(eq(statuses.projectID, projectID)).limit(1);
  return row.id;
}

async function getStatusIDBySlug(slug: string): Promise<string> {
  const [row] = await db
    .select({ id: statuses.id })
    .from(statuses)
    .where(and(eq(statuses.projectID, projectID), eq(statuses.slug, slug)))
    .limit(1);
  return row.id;
}

async function createTicket(overrides: Partial<{ title: string; description: string; statusID: string; priority: string }> = {}) {
  const res = await app.request("/api/projects/TEST/tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookies },
    body: JSON.stringify({
      title: "Initial ticket",
      description: "A description",
      statusID,
      ...overrides,
    }),
  });
  const body = await res.json();
  return body.ticket;
}

describe("POST /api/projects/:key/tickets", () => {
  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
    const project = await createProject(cookies);
    projectID = project.id;
    statusID = await seedStatusID();
  });

  it("creates a ticket", async () => {
    const res = await app.request("/api/projects/TEST/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ title: "First ticket", description: "Body", statusID }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ticket.title).toBe("First ticket");
    expect(body.ticket.description).toBe("Body");
    expect(body.ticket.projectID).toBe(projectID);
    expect(body.ticket.statusID).toBe(statusID);
    expect(body.ticket.priority).toBe("medium");
    expect(body.ticket.number).toBe(1);
  });

  it("writes a created activity row", async () => {
    const ticket = await createTicket({ title: "Audit me" });

    const rows = await db.select().from(ticketActivity).where(eq(ticketActivity.ticketID, ticket.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("created");
    expect(rows[0].newValue).toEqual({ value: "Audit me" });
  });

  it("increments ticket number per project", async () => {
    await createTicket({ title: "One" });
    const second = await createTicket({ title: "Two" });
    expect(second.number).toBe(2);
  });

  it("places new ticket after existing ones in the status column", async () => {
    const first = await createTicket({ title: "One" });
    const second = await createTicket({ title: "Two" });
    expect(second.position > first.position).toBe(true);
  });

  it("respects provided priority", async () => {
    const ticket = await createTicket({ priority: "high" });
    expect(ticket.priority).toBe("high");
  });

  it("defaults description to an empty string", async () => {
    const res = await app.request("/api/projects/TEST/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ title: "No description", statusID }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ticket.description).toBe("");
  });

  it("attaches provided labels", async () => {
    const [label] = await db.select({ id: labels.id }).from(labels).where(eq(labels.projectID, projectID)).limit(1);

    const res = await app.request("/api/projects/TEST/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ title: "With label", statusID, labelIDs: [label.id] }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();

    const rows = await db.select().from(ticketLabels).where(eq(ticketLabels.ticketID, body.ticket.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].labelID).toBe(label.id);
  });

  it("returns 401 for non-authenticated requests", async () => {
    const res = await app.request("/api/projects/TEST/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "First ticket", statusID }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent project", async () => {
    const res = await app.request("/api/projects/NOPE/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ title: "First ticket", statusID }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 for non-member", async () => {
    const { cookies: otherCookies } = await createExtraUser("Other", "other@test.com");
    const res = await app.request("/api/projects/TEST/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: otherCookies },
      body: JSON.stringify({ title: "First ticket", statusID }),
    });
    expect(res.status).toBe(404);
  });

  it("rejects missing title", async () => {
    const res = await app.request("/api/projects/TEST/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ statusID }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects empty title", async () => {
    const res = await app.request("/api/projects/TEST/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ title: "   ", statusID }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects invalid statusID", async () => {
    const res = await app.request("/api/projects/TEST/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ title: "Bad", statusID: "not-a-uuid" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects unknown fields", async () => {
    const res = await app.request("/api/projects/TEST/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ title: "Bad", statusID, nope: true }),
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/projects/:key/tickets", () => {
  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
    const project = await createProject(cookies);
    projectID = project.id;
    statusID = await seedStatusID();
  });

  it("returns an empty list for a new project", async () => {
    const res = await app.request("/api/projects/TEST/tickets", { headers: { Cookie: cookies } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tickets).toEqual([]);
  });

  it("returns created tickets", async () => {
    await createTicket({ title: "One" });
    await createTicket({ title: "Two" });

    const res = await app.request("/api/projects/TEST/tickets", { headers: { Cookie: cookies } });
    const body = await res.json();
    expect(body.tickets).toHaveLength(2);
  });

  it("filters tickets by statusID", async () => {
    const backlogStatusID = await getStatusIDBySlug("backlog");
    const doneStatusID = await getStatusIDBySlug("done");

    await createTicket({ title: "Backlog", statusID: backlogStatusID });
    await createTicket({ title: "Done", statusID: doneStatusID });

    const res = await app.request(`/api/projects/TEST/tickets?statusID=${doneStatusID}`, { headers: { Cookie: cookies } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.tickets).toHaveLength(1);
    expect(body.tickets[0].statusID).toBe(doneStatusID);
  });

  it("filters tickets by priority", async () => {
    await createTicket({ title: "Low", priority: "low" });
    await createTicket({ title: "High", priority: "high" });

    const res = await app.request("/api/projects/TEST/tickets?priority=high", { headers: { Cookie: cookies } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.tickets).toHaveLength(1);
    expect(body.tickets[0].priority).toBe("high");
  });

  it("supports pagination", async () => {
    await createTicket({ title: "One" });
    await createTicket({ title: "Two" });
    await createTicket({ title: "Three" });

    const res = await app.request("/api/projects/TEST/tickets?page=2&perPage=2", { headers: { Cookie: cookies } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.tickets).toHaveLength(1);
  });

  it("sorts before paginating", async () => {
    await createTicket({ title: "Charlie" });
    await createTicket({ title: "Alpha" });
    await createTicket({ title: "Bravo" });

    const res = await app.request("/api/projects/TEST/tickets?sortBy=title&sortDirection=asc&page=2&perPage=1", { headers: { Cookie: cookies } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.tickets).toHaveLength(1);
    expect(body.tickets[0].title).toBe("Bravo");
  });

  it("excludes soft-deleted tickets", async () => {
    const ticket = await createTicket({ title: "One" });
    await app.request(`/api/projects/TEST/tickets/${ticket.number}`, {
      method: "DELETE",
      headers: { Cookie: cookies },
    });

    const res = await app.request("/api/projects/TEST/tickets", { headers: { Cookie: cookies } });
    const body = await res.json();
    expect(body.tickets).toHaveLength(0);
  });

  it("returns 401 for non-authenticated requests", async () => {
    const res = await app.request("/api/projects/TEST/tickets");
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-member", async () => {
    const { cookies: otherCookies } = await createExtraUser("Other", "other@test.com");
    const res = await app.request("/api/projects/TEST/tickets", { headers: { Cookie: otherCookies } });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/projects/:key/tickets/board", () => {
  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
    const project = await createProject(cookies);
    projectID = project.id;
    statusID = await seedStatusID();
  });

  it("returns board tickets in raw fractional-position order", async () => {
    const activeStatusID = await getStatusIDBySlug("in-progress");
    const top = await createTicket({ title: "Top", statusID: activeStatusID });
    const middle = await createTicket({ title: "Middle", statusID: activeStatusID });
    const bottom = await createTicket({ title: "Bottom", statusID: activeStatusID });

    await db.update(tickets).set({ position: "Zz" }).where(eq(tickets.id, top.id));
    await db.update(tickets).set({ position: "a0" }).where(eq(tickets.id, middle.id));
    await db.update(tickets).set({ position: "a1" }).where(eq(tickets.id, bottom.id));

    const res = await app.request("/api/projects/TEST/tickets/board", { headers: { Cookie: cookies } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.tickets.map((ticket: { title: string }) => ticket.title)).toEqual(["Top", "Middle", "Bottom"]);
  });

  it("does not apply the list endpoint's default pagination", async () => {
    const activeStatusID = await getStatusIDBySlug("in-progress");
    for (let i = 1; i <= 26; i += 1) {
      await createTicket({ title: `Ticket ${i}`, statusID: activeStatusID });
    }

    const res = await app.request("/api/projects/TEST/tickets/board", { headers: { Cookie: cookies } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.tickets).toHaveLength(26);
  });

  it("filters board tickets", async () => {
    const backlogStatusID = await getStatusIDBySlug("backlog");
    const doneStatusID = await getStatusIDBySlug("done");

    await createTicket({ title: "Backlog high", statusID: backlogStatusID, priority: "high" });
    await createTicket({ title: "Done high", statusID: doneStatusID, priority: "high" });
    await createTicket({ title: "Done low", statusID: doneStatusID, priority: "low" });

    const res = await app.request(`/api/projects/TEST/tickets/board?statusID=${doneStatusID}&priority=high`, { headers: { Cookie: cookies } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.tickets).toHaveLength(1);
    expect(body.tickets[0].title).toBe("Done high");
  });
});

describe("GET /api/projects/:key/tickets/:num", () => {
  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
    const project = await createProject(cookies);
    projectID = project.id;
    statusID = await seedStatusID();
  });

  it("returns the ticket with relations", async () => {
    const created = await createTicket({ title: "Hello" });

    const res = await app.request(`/api/projects/TEST/tickets/${created.number}`, { headers: { Cookie: cookies } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ticket.id).toBe(created.id);
    expect(body.ticket.title).toBe("Hello");
    expect(body.ticket.status.id).toBe(statusID);
    expect(body.ticket.reporter).toBeDefined();
    expect(Array.isArray(body.ticket.labels)).toBe(true);
  });

  it("returns 401 for non-authenticated requests", async () => {
    const created = await createTicket();
    const res = await app.request(`/api/projects/TEST/tickets/${created.number}`);
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-member", async () => {
    const created = await createTicket();
    const { cookies: otherCookies } = await createExtraUser("Other", "other@test.com");

    const res = await app.request(`/api/projects/TEST/tickets/${created.number}`, { headers: { Cookie: otherCookies } });
    expect(res.status).toBe(404);
  });

  it("returns 404 for non-existent ticket number", async () => {
    const res = await app.request("/api/projects/TEST/tickets/999", { headers: { Cookie: cookies } });
    expect(res.status).toBe(404);
  });

  it("returns 400 for non-numeric ticket number", async () => {
    const res = await app.request("/api/projects/TEST/tickets/abc", { headers: { Cookie: cookies } });
    expect(res.status).toBe(400);
  });

  it("returns 404 for soft-deleted tickets", async () => {
    const created = await createTicket();

    await app.request(`/api/projects/TEST/tickets/${created.number}`, {
      method: "DELETE",
      headers: { Cookie: cookies },
    });

    const res = await app.request(`/api/projects/TEST/tickets/${created.number}`, { headers: { Cookie: cookies } });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/projects/:key/tickets/:num", () => {
  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
    const project = await createProject(cookies);
    projectID = project.id;
    statusID = await seedStatusID();
  });

  it("updates ticket fields", async () => {
    const created = await createTicket({ title: "Before" });

    const res = await app.request(`/api/projects/TEST/tickets/${created.number}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ title: "After", priority: "high" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ticket.title).toBe("After");
    expect(body.ticket.priority).toBe("high");
  });

  it("writes one activity row per changed field", async () => {
    const created = await createTicket({ title: "Before" });

    await app.request(`/api/projects/TEST/tickets/${created.number}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ title: "After", priority: "high" }),
    });

    const rows = await db
      .select()
      .from(ticketActivity)
      .where(and(eq(ticketActivity.ticketID, created.id), eq(ticketActivity.action, "updated")));

    const byField = new Map(rows.map((r) => [r.fieldName, r]));
    expect(byField.get("title")?.oldValue).toEqual({ value: "Before" });
    expect(byField.get("title")?.newValue).toEqual({ value: "After" });
    expect(byField.get("priority")?.oldValue).toEqual({ value: "medium" });
    expect(byField.get("priority")?.newValue).toEqual({ value: "high" });
  });

  it("replaces labels and writes label_added rows", async () => {
    const created = await createTicket({ title: "Label me" });
    const [label] = await db.select({ id: labels.id, name: labels.name }).from(labels).where(eq(labels.projectID, projectID)).limit(1);

    await app.request(`/api/projects/TEST/tickets/${created.number}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ labelIDs: [label.id] }),
    });

    const joined = await db.select().from(ticketLabels).where(eq(ticketLabels.ticketID, created.id));
    expect(joined).toHaveLength(1);

    const added = await db
      .select()
      .from(ticketActivity)
      .where(and(eq(ticketActivity.ticketID, created.id), eq(ticketActivity.action, "label_added")));
    expect(added).toHaveLength(1);
    expect(added[0].newValue).toEqual({ id: label.id, name: label.name });
  });

  it("writes no activity rows when the patch is a no-op", async () => {
    const created = await createTicket({ title: "Stable" });

    await app.request(`/api/projects/TEST/tickets/${created.number}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ title: "Stable" }),
    });

    const rows = await db
      .select()
      .from(ticketActivity)
      .where(and(eq(ticketActivity.ticketID, created.id), eq(ticketActivity.action, "updated")));
    expect(rows).toHaveLength(0);
  });

  it("returns 401 for non-authenticated requests", async () => {
    const created = await createTicket();
    const res = await app.request(`/api/projects/TEST/tickets/${created.number}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Nope" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-member", async () => {
    const created = await createTicket();
    const { cookies: otherCookies } = await createExtraUser("Other", "other@test.com");

    const res = await app.request(`/api/projects/TEST/tickets/${created.number}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: otherCookies },
      body: JSON.stringify({ title: "Nope" }),
    });

    expect(res.status).toBe(404);
  });

  it("returns 404 for non-existent ticket number", async () => {
    const res = await app.request("/api/projects/TEST/tickets/999", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ title: "Nope" }),
    });
    expect(res.status).toBe(404);
  });

  it("rejects unknown fields", async () => {
    const created = await createTicket();
    const res = await app.request(`/api/projects/TEST/tickets/${created.number}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ title: "Ok", rogue: 1 }),
    });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/projects/:key/tickets/:num/move", () => {
  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
    const project = await createProject(cookies);
    projectID = project.id;
    statusID = await seedStatusID();
  });

  it("moves ticket between two neighbours", async () => {
    const a = await createTicket({ title: "A" });
    const b = await createTicket({ title: "B" });
    const c = await createTicket({ title: "C" });

    const res = await app.request(`/api/projects/TEST/tickets/${c.number}/move`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ beforeID: a.id, afterID: b.id }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ticket.position > a.position).toBe(true);
    expect(body.ticket.position < b.position).toBe(true);
  });

  it("changes status when provided", async () => {
    const [otherStatus] = await db
      .select({ id: statuses.id })
      .from(statuses)
      .where(and(eq(statuses.projectID, projectID), eq(statuses.slug, "done")))
      .limit(1);
    const ticket = await createTicket({ title: "A" });

    const res = await app.request(`/api/projects/TEST/tickets/${ticket.number}/move`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ statusID: otherStatus.id, beforeID: null, afterID: null }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ticket.statusID).toBe(otherStatus.id);

    const rows = await db
      .select()
      .from(ticketActivity)
      .where(and(eq(ticketActivity.ticketID, ticket.id), eq(ticketActivity.action, "updated"), eq(ticketActivity.fieldName, "statusID")));
    expect(rows).toHaveLength(1);
    expect((rows[0].newValue as { id: string }).id).toBe(otherStatus.id);
  });

  it("writes no activity rows for a position-only move", async () => {
    const a = await createTicket({ title: "A" });
    const b = await createTicket({ title: "B" });
    const c = await createTicket({ title: "C" });

    await app.request(`/api/projects/TEST/tickets/${c.number}/move`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ beforeID: a.id, afterID: b.id }),
    });

    const rows = await db
      .select()
      .from(ticketActivity)
      .where(and(eq(ticketActivity.ticketID, c.id), eq(ticketActivity.action, "updated")));
    expect(rows).toHaveLength(0);
  });

  it("returns 401 for non-authenticated requests", async () => {
    const ticket = await createTicket();
    const res = await app.request(`/api/projects/TEST/tickets/${ticket.number}/move`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-member", async () => {
    const ticket = await createTicket();
    const { cookies: otherCookies } = await createExtraUser("Other", "other@test.com");

    const res = await app.request(`/api/projects/TEST/tickets/${ticket.number}/move`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: otherCookies },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(404);
  });

  it("returns 404 for non-existent ticket number", async () => {
    const res = await app.request("/api/projects/TEST/tickets/999/move", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/projects/:key/tickets/:num", () => {
  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
    const project = await createProject(cookies);
    projectID = project.id;
    statusID = await seedStatusID();
  });

  it("soft-deletes the ticket", async () => {
    const ticket = await createTicket();

    const res = await app.request(`/api/projects/TEST/tickets/${ticket.number}`, {
      method: "DELETE",
      headers: { Cookie: cookies },
    });

    expect(res.status).toBe(204);
    const [row] = await db.select().from(tickets).where(eq(tickets.id, ticket.id));
    expect(row.deletedAt).not.toBeNull();

    const [activeRow] = await db
      .select()
      .from(tickets)
      .where(and(eq(tickets.id, ticket.id), isNull(tickets.deletedAt)));
    expect(activeRow).toBeUndefined();
  });

  it("writes a deleted activity row", async () => {
    const ticket = await createTicket({ title: "Gone" });

    await app.request(`/api/projects/TEST/tickets/${ticket.number}`, {
      method: "DELETE",
      headers: { Cookie: cookies },
    });

    const rows = await db
      .select()
      .from(ticketActivity)
      .where(and(eq(ticketActivity.ticketID, ticket.id), eq(ticketActivity.action, "deleted")));
    expect(rows).toHaveLength(1);
    expect(rows[0].newValue).toEqual({ value: "Gone" });
  });

  it("returns 401 for non-authenticated requests", async () => {
    const ticket = await createTicket();
    const res = await app.request(`/api/projects/TEST/tickets/${ticket.number}`, { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent ticket number", async () => {
    const res = await app.request("/api/projects/TEST/tickets/999", {
      method: "DELETE",
      headers: { Cookie: cookies },
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 for non-member", async () => {
    const ticket = await createTicket();
    const { cookies: otherCookies } = await createExtraUser("Other", "other@test.com");
    const res = await app.request(`/api/projects/TEST/tickets/${ticket.number}`, {
      method: "DELETE",
      headers: { Cookie: otherCookies },
    });
    expect(res.status).toBe(404);
  });
});
