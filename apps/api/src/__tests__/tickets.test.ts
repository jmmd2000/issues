import { describe, it, expect, beforeEach } from "vitest";
import app from "../index";
import { db } from "../db";
import { attachments, labels, projectMembers, statuses, ticketActivity, ticketLabels, ticketLinks, tickets } from "../db/schema";
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

  it("returns an empty children array when the ticket has no sub-tickets", async () => {
    const created = await createTicket({ title: "Solo" });
    const res = await app.request(`/api/projects/TEST/tickets/${created.number}`, { headers: { Cookie: cookies } });
    const body = await res.json();
    expect(body.ticket.children).toEqual([]);
  });

  it("returns children with status, priority and assignee on the parent", async () => {
    const parent = await createTicket({ title: "Parent" });

    const childA = await app.request("/api/projects/TEST/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ title: "Child A", statusID, parentTicketID: parent.id, priority: "high" }),
    });
    expect(childA.status).toBe(201);

    const childB = await app.request("/api/projects/TEST/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ title: "Child B", statusID, parentTicketID: parent.id }),
    });
    expect(childB.status).toBe(201);

    const res = await app.request(`/api/projects/TEST/tickets/${parent.number}`, { headers: { Cookie: cookies } });
    const body = await res.json();
    expect(body.ticket.children).toHaveLength(2);
    expect(body.ticket.children.map((c: { title: string }) => c.title).sort()).toEqual(["Child A", "Child B"]);
    expect(body.ticket.children[0].status).toMatchObject({ name: expect.any(String), category: expect.any(String) });
  });

  it("excludes soft-deleted children from the parent's children array", async () => {
    const parent = await createTicket({ title: "Parent" });
    const childRes = await app.request("/api/projects/TEST/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ title: "Doomed child", statusID, parentTicketID: parent.id }),
    });
    const child = (await childRes.json()).ticket;

    await app.request(`/api/projects/TEST/tickets/${child.number}`, { method: "DELETE", headers: { Cookie: cookies } });

    const res = await app.request(`/api/projects/TEST/tickets/${parent.number}`, { headers: { Cookie: cookies } });
    const body = await res.json();
    expect(body.ticket.children).toEqual([]);
  });

  it("sorts children with open categories first, then by ticket number", async () => {
    const parent = await createTicket({ title: "Parent" });
    const doneStatus = await getStatusIDBySlug("done");
    const inProgressStatus = await getStatusIDBySlug("in-progress");
    const backlogStatus = await getStatusIDBySlug("backlog");

    const titles = [
      ["Done child", doneStatus],
      ["Active child", inProgressStatus],
      ["Backlog child", backlogStatus],
    ] as const;

    for (const [title, sid] of titles) {
      await app.request("/api/projects/TEST/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookies },
        body: JSON.stringify({ title, statusID: sid, parentTicketID: parent.id }),
      });
    }

    const res = await app.request(`/api/projects/TEST/tickets/${parent.number}`, { headers: { Cookie: cookies } });
    const body = await res.json();
    const orderedTitles = body.ticket.children.map((c: { title: string }) => c.title);
    expect(orderedTitles).toEqual(["Backlog child", "Active child", "Done child"]);
  });
});

describe("PATCH /api/projects/:key/tickets/:num parent cycle guard", () => {
  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
    const project = await createProject(cookies);
    projectID = project.id;
    statusID = await seedStatusID();
  });

  it("returns 400 when setting a ticket as its own parent", async () => {
    const ticket = await createTicket({ title: "Self" });

    const res = await app.request(`/api/projects/TEST/tickets/${ticket.number}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ parentTicketID: ticket.id }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when setting an ancestor's parent to a descendant (cycle of 2)", async () => {
    const a = await createTicket({ title: "A" });
    const bRes = await app.request("/api/projects/TEST/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ title: "B", statusID, parentTicketID: a.id }),
    });
    const b = (await bRes.json()).ticket;

    // A -> B exists. Trying to set B as A's parent forms cycle: A -> B -> A.
    const res = await app.request(`/api/projects/TEST/tickets/${a.number}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ parentTicketID: b.id }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for a deeper cycle (length 3)", async () => {
    const a = await createTicket({ title: "A" });
    const bRes = await app.request("/api/projects/TEST/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ title: "B", statusID, parentTicketID: a.id }),
    });
    const b = (await bRes.json()).ticket;
    const cRes = await app.request("/api/projects/TEST/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ title: "C", statusID, parentTicketID: b.id }),
    });
    const c = (await cRes.json()).ticket;

    // A -> B -> C exists. Setting C as A's parent forms cycle: A -> B -> C -> A.
    const res = await app.request(`/api/projects/TEST/tickets/${a.number}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ parentTicketID: c.id }),
    });
    expect(res.status).toBe(400);
  });

  it("allows clearing the parent (null)", async () => {
    const a = await createTicket({ title: "A" });
    const bRes = await app.request("/api/projects/TEST/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ title: "B", statusID, parentTicketID: a.id }),
    });
    const b = (await bRes.json()).ticket;

    const res = await app.request(`/api/projects/TEST/tickets/${b.number}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ parentTicketID: null }),
    });
    expect(res.status).toBe(200);

    const after = await app.request(`/api/projects/TEST/tickets/${b.number}`, { headers: { Cookie: cookies } });
    const body = await after.json();
    expect(body.ticket.parent).toBeNull();
  });

  it("allows setting an unrelated ticket as parent", async () => {
    const a = await createTicket({ title: "A" });
    const b = await createTicket({ title: "B" });

    const res = await app.request(`/api/projects/TEST/tickets/${a.number}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ parentTicketID: b.id }),
    });
    expect(res.status).toBe(200);
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

describe("POST /api/projects/:key/tickets/:num/restore", () => {
  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
    const project = await createProject(cookies);
    projectID = project.id;
    statusID = await seedStatusID();
  });

  async function softDelete(num: number) {
    await app.request(`/api/projects/TEST/tickets/${num}`, { method: "DELETE", headers: { Cookie: cookies } });
  }

  it("restores a soft-deleted ticket", async () => {
    const ticket = await createTicket({ title: "Bring me back" });
    await softDelete(ticket.number);

    const res = await app.request(`/api/projects/TEST/tickets/${ticket.number}/restore`, { method: "POST", headers: { Cookie: cookies } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ticket.id).toBe(ticket.id);
    expect(body.ticket.deletedAt).toBeNull();

    const [row] = await db.select().from(tickets).where(eq(tickets.id, ticket.id));
    expect(row.deletedAt).toBeNull();
  });

  it("writes a restored activity row", async () => {
    const ticket = await createTicket({ title: "Phoenix" });
    await softDelete(ticket.number);

    await app.request(`/api/projects/TEST/tickets/${ticket.number}/restore`, { method: "POST", headers: { Cookie: cookies } });

    const rows = await db
      .select()
      .from(ticketActivity)
      .where(and(eq(ticketActivity.ticketID, ticket.id), eq(ticketActivity.action, "restored")));
    expect(rows).toHaveLength(1);
    expect(rows[0].newValue).toEqual({ value: "Phoenix" });
  });

  it("returns 401 for non-authenticated requests", async () => {
    const ticket = await createTicket();
    await softDelete(ticket.number);

    const res = await app.request(`/api/projects/TEST/tickets/${ticket.number}/restore`, { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-member", async () => {
    const ticket = await createTicket();
    await softDelete(ticket.number);
    const { cookies: otherCookies } = await createExtraUser("Other", "other@test.com");

    const res = await app.request(`/api/projects/TEST/tickets/${ticket.number}/restore`, { method: "POST", headers: { Cookie: otherCookies } });
    expect(res.status).toBe(404);
  });

  it("returns 404 when the ticket is not soft-deleted", async () => {
    const ticket = await createTicket({ title: "Still here" });

    const res = await app.request(`/api/projects/TEST/tickets/${ticket.number}/restore`, { method: "POST", headers: { Cookie: cookies } });
    expect(res.status).toBe(404);
  });

  it("returns 404 for a non-existent ticket number", async () => {
    const res = await app.request("/api/projects/TEST/tickets/999/restore", { method: "POST", headers: { Cookie: cookies } });
    expect(res.status).toBe(404);
  });

  it("returns 400 for a non-numeric ticket number", async () => {
    const res = await app.request("/api/projects/TEST/tickets/abc/restore", { method: "POST", headers: { Cookie: cookies } });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/projects/:key/tickets/:num/clone", () => {
  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
    const project = await createProject(cookies);
    projectID = project.id;
    statusID = await seedStatusID();
  });

  async function cloneRequest(num: number, body: object, authCookies = cookies) {
    return app.request(`/api/projects/TEST/tickets/${num}/clone`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: authCookies },
      body: JSON.stringify(body),
    });
  }

  it("creates a clone, links it, and emits cloned_from + link_added activity rows on both sides", async () => {
    const source = await createTicket({ title: "Source" });

    const res = await cloneRequest(source.number, {
      ticket: { title: "Cloned title", statusID, priority: "high" },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    const clone = body.ticket;
    expect(clone.id).not.toBe(source.id);
    expect(clone.title).toBe("Cloned title");
    expect(clone.priority).toBe("high");

    // The clone owns the canonical link as source -- "clones <original>" --
    // so reading from either side renders correctly.
    const links = await db.select().from(ticketLinks).where(eq(ticketLinks.sourceTicketID, clone.id));
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ targetTicketID: source.id, linkType: "clones" });

    const cloneActivity = await db.select().from(ticketActivity).where(eq(ticketActivity.ticketID, clone.id));
    const cloneActions = cloneActivity.map((row) => row.action).sort();
    expect(cloneActions).toContain("cloned_from");
    expect(cloneActions).toContain("link_added");

    const clonedFrom = cloneActivity.find((row) => row.action === "cloned_from");
    expect(clonedFrom?.newValue).toMatchObject({ id: source.id, number: source.number, title: "Source", projectKey: "TEST" });

    const sourceActivity = await db
      .select()
      .from(ticketActivity)
      .where(and(eq(ticketActivity.ticketID, source.id), eq(ticketActivity.action, "link_added")));
    expect(sourceActivity).toHaveLength(1);
    expect(sourceActivity[0].fieldName).toBe("clones");
  });

  it("copies attachment rows when copyAttachments is true and skips them otherwise", async () => {
    const source = await createTicket({ title: "Has attachments" });

    const sample = {
      uploaderID: (await db.select({ id: tickets.reporterID }).from(tickets).where(eq(tickets.id, source.id)))[0].id,
      ticketID: source.id,
      filename: "a.png",
      storageKey: "deadbeef.png",
      contentHash: "deadbeef",
      sizeBytes: 100,
      width: 10,
      height: 10,
      mimeType: "image/png",
      isImage: true,
    };
    await db.insert(attachments).values(sample);

    const skipRes = await cloneRequest(source.number, { ticket: { title: "Clone no attach", statusID } });
    const skipClone = (await skipRes.json()).ticket;
    const skipRows = await db.select().from(attachments).where(eq(attachments.ticketID, skipClone.id));
    expect(skipRows).toHaveLength(0);

    const copyRes = await cloneRequest(source.number, { ticket: { title: "Clone with attach", statusID }, copyAttachments: true });
    const copyClone = (await copyRes.json()).ticket;
    const copyRows = await db.select().from(attachments).where(eq(attachments.ticketID, copyClone.id));
    expect(copyRows).toHaveLength(1);
    // The new row reuses the storage_key so we don't double-store the bytes.
    expect(copyRows[0].storageKey).toBe(sample.storageKey);
  });

  it("returns 404 when cloning a soft-deleted ticket", async () => {
    const source = await createTicket({ title: "Doomed" });
    await app.request(`/api/projects/TEST/tickets/${source.number}`, { method: "DELETE", headers: { Cookie: cookies } });

    const res = await cloneRequest(source.number, { ticket: { title: "Clone", statusID } });
    expect(res.status).toBe(404);
  });

  it("returns 401 for non-authenticated requests", async () => {
    const source = await createTicket();
    const res = await app.request(`/api/projects/TEST/tickets/${source.number}/clone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket: { title: "Clone", statusID } }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-member", async () => {
    const source = await createTicket();
    const { cookies: otherCookies } = await createExtraUser("Other", "other@test.com");
    const res = await cloneRequest(source.number, { ticket: { title: "Clone", statusID } }, otherCookies);
    expect(res.status).toBe(404);
  });

  it("rejects unknown fields", async () => {
    const source = await createTicket();
    const res = await cloneRequest(source.number, { ticket: { title: "Clone", statusID }, rogue: 1 });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/projects/:key/tickets/trash", () => {
  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
    const project = await createProject(cookies);
    projectID = project.id;
    statusID = await seedStatusID();
  });

  async function softDelete(num: number) {
    await app.request(`/api/projects/TEST/tickets/${num}`, { method: "DELETE", headers: { Cookie: cookies } });
  }

  it("lists soft-deleted tickets and excludes active ones", async () => {
    const a = await createTicket({ title: "Trashed" });
    const b = await createTicket({ title: "Active" });
    await softDelete(a.number);
    void b;

    const res = await app.request("/api/projects/TEST/tickets/trash", { headers: { Cookie: cookies } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tickets).toHaveLength(1);
    expect(body.tickets[0].id).toBe(a.id);
  });

  it("supports pagination", async () => {
    for (let i = 1; i <= 3; i += 1) {
      const ticket = await createTicket({ title: `T${i}` });
      await softDelete(ticket.number);
    }
    const res = await app.request("/api/projects/TEST/tickets/trash?page=2&perPage=2", { headers: { Cookie: cookies } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tickets).toHaveLength(1);
  });

  it("returns 403 for non-owner members", async () => {
    const ticket = await createTicket({ title: "Doomed" });
    await softDelete(ticket.number);
    const { user, cookies: otherCookies } = await createExtraUser("Other", "other@test.com");
    await db.insert(projectMembers).values({ projectID, userID: user.id, role: "member" });

    const res = await app.request("/api/projects/TEST/tickets/trash", { headers: { Cookie: otherCookies } });
    expect(res.status).toBe(403);
  });

  it("returns 404 for non-members", async () => {
    const { cookies: otherCookies } = await createExtraUser("Other", "other@test.com");
    const res = await app.request("/api/projects/TEST/tickets/trash", { headers: { Cookie: otherCookies } });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/projects/:key/tickets/:num/permanent", () => {
  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
    const project = await createProject(cookies);
    projectID = project.id;
    statusID = await seedStatusID();
  });

  async function softDelete(num: number) {
    await app.request(`/api/projects/TEST/tickets/${num}`, { method: "DELETE", headers: { Cookie: cookies } });
  }

  it("hard-deletes a soft-deleted ticket and returns 204", async () => {
    const ticket = await createTicket({ title: "Goner" });
    await softDelete(ticket.number);

    const res = await app.request(`/api/projects/TEST/tickets/${ticket.number}/permanent`, { method: "DELETE", headers: { Cookie: cookies } });
    expect(res.status).toBe(204);

    const rows = await db.select().from(tickets).where(eq(tickets.id, ticket.id));
    expect(rows).toHaveLength(0);
  });

  it("returns 404 when the ticket is still active", async () => {
    const ticket = await createTicket({ title: "Alive" });

    const res = await app.request(`/api/projects/TEST/tickets/${ticket.number}/permanent`, { method: "DELETE", headers: { Cookie: cookies } });
    expect(res.status).toBe(404);
  });

  it("returns 404 for a non-existent ticket number", async () => {
    const res = await app.request("/api/projects/TEST/tickets/999/permanent", { method: "DELETE", headers: { Cookie: cookies } });
    expect(res.status).toBe(404);
  });

  it("returns 403 for non-owner members", async () => {
    const ticket = await createTicket({ title: "Doomed" });
    await softDelete(ticket.number);
    const { user, cookies: otherCookies } = await createExtraUser("Other", "other@test.com");
    await db.insert(projectMembers).values({ projectID, userID: user.id, role: "member" });

    const res = await app.request(`/api/projects/TEST/tickets/${ticket.number}/permanent`, { method: "DELETE", headers: { Cookie: otherCookies } });
    expect(res.status).toBe(403);
  });
});
