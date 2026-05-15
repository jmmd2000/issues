import { describe, it, expect, beforeEach } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import app from "../index";
import { db } from "../db";
import { labels, projectMembers, statuses, ticketActivity, ticketLabels, tickets } from "../db/schema";
import { createAuthenticatedUser, createExtraUser, createProject, createTokenForUser, resetDatabase } from "./helpers";

let cookies: string;
let userID: string;
let projectID: string;

async function statusBySlug(slug: string) {
  const [row] = await db.select().from(statuses).where(and(eq(statuses.projectID, projectID), eq(statuses.slug, slug))).limit(1);
  return row;
}

async function labelByName(name: string) {
  const [row] = await db.select().from(labels).where(and(eq(labels.projectID, projectID), eq(labels.name, name))).limit(1);
  return row;
}

async function createTicketRow(overrides: { title?: string; statusSlug?: string; priority?: string; assignee?: string | null; labels?: string[] } = {}) {
  const status = await statusBySlug(overrides.statusSlug ?? "backlog");
  const labelIDs = overrides.labels ? await Promise.all(overrides.labels.map(async (name) => (await labelByName(name)).id)) : undefined;

  const res = await app.request("/api/projects/TEST/tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookies },
    body: JSON.stringify({
      title: overrides.title ?? "Sample ticket",
      statusID: status.id,
      priority: overrides.priority,
      labelIDs,
    }),
  });
  const body = await res.json();
  return body.ticket;
}

async function setupProject() {
  await resetDatabase();
  const auth = await createAuthenticatedUser();
  cookies = auth.cookies;
  userID = auth.user.id;
  const project = await createProject(cookies);
  projectID = project.id;
}

describe("GET /api/mcp/projects", () => {
  beforeEach(setupProject);

  it("lists projects the user is a member of", async () => {
    const res = await app.request("/api/mcp/projects", { method: "GET", headers: { Cookie: cookies } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.projects).toEqual([{ key: "TEST", name: "Test Project" }]);
  });

  it("excludes projects the user is not a member of", async () => {
    const other = await createExtraUser("Other", "other@test.com");
    await createProject(other.cookies, { key: "OTHER", name: "Other Project" });
    await db.delete(projectMembers).where(eq(projectMembers.userID, userID));

    const res = await app.request("/api/mcp/projects", { method: "GET", headers: { Cookie: cookies } });
    const body = await res.json();
    expect(body.projects).toEqual([]);
  });

  it("returns 401 without authentication", async () => {
    const res = await app.request("/api/mcp/projects", { method: "GET" });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/mcp/tickets", () => {
  beforeEach(setupProject);

  it("creates a ticket using slug + label names + assignee name", async () => {
    const res = await app.request("/api/mcp/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({
        project: "TEST",
        title: "Add login form",
        description: "Build the login form on the auth page.",
        statusSlug: "in-progress",
        priority: "high",
        labels: ["Bug", "Feature"],
        assignee: "Test User",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ticket.ref).toBe("TEST-1");
    expect(body.ticket.title).toBe("Add login form");
    expect(body.ticket.status).toBe("In Progress");
    expect(body.ticket.priority).toBe("high");
    expect(body.ticket.labels).toEqual(["Bug", "Feature"]);
    expect(body.ticket.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("uses the project's first status when statusSlug is omitted", async () => {
    const res = await app.request("/api/mcp/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ project: "TEST", title: "Quick capture" }),
    });

    const body = await res.json();
    expect(body.ticket.status).toBe("Backlog");
  });

  it("returns 400 for an unknown status slug", async () => {
    const res = await app.request("/api/mcp/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ project: "TEST", title: "x", statusSlug: "nope" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an unknown label name", async () => {
    const res = await app.request("/api/mcp/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ project: "TEST", title: "x", labels: ["NotALabel"] }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an unknown assignee name", async () => {
    const res = await app.request("/api/mcp/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ project: "TEST", title: "x", assignee: "Ghost User" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown project key", async () => {
    const res = await app.request("/api/mcp/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ project: "ZZZZ", title: "x" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 401 without authentication", async () => {
    const res = await app.request("/api/mcp/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: "TEST", title: "x" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/mcp/tickets", () => {
  beforeEach(setupProject);

  it("filters by status slug and label name", async () => {
    await createTicketRow({ title: "Bug A", statusSlug: "in-progress", labels: ["Bug"] });
    await createTicketRow({ title: "Feat A", statusSlug: "in-progress", labels: ["Feature"] });
    await createTicketRow({ title: "Bug B", statusSlug: "backlog", labels: ["Bug"] });

    const res = await app.request("/api/mcp/tickets?project=TEST&status=in-progress&label=Bug", { method: "GET", headers: { Cookie: cookies } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tickets.map((t: { title: string }) => t.title)).toEqual(["Bug A"]);
  });

  it("filters by priority", async () => {
    await createTicketRow({ title: "Critical thing", priority: "critical" });
    await createTicketRow({ title: "Low thing", priority: "low" });

    const res = await app.request("/api/mcp/tickets?project=TEST&priority=critical", { method: "GET", headers: { Cookie: cookies } });
    const body = await res.json();
    expect(body.tickets).toHaveLength(1);
    expect(body.tickets[0].title).toBe("Critical thing");
  });

  it("returns refs in KEY-NUM form and no UUIDs", async () => {
    await createTicketRow({ title: "Anything" });
    const res = await app.request("/api/mcp/tickets?project=TEST", { method: "GET", headers: { Cookie: cookies } });
    const body = await res.json();
    expect(body.tickets[0].ref).toMatch(/^TEST-\d+$/);
    expect(body.tickets[0]).not.toHaveProperty("id");
    expect(body.tickets[0]).not.toHaveProperty("statusID");
  });

  it("caps limit at 50", async () => {
    const res = await app.request("/api/mcp/tickets?project=TEST&limit=999", { method: "GET", headers: { Cookie: cookies } });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/mcp/tickets/:ref", () => {
  beforeEach(setupProject);

  it("returns compact detail with description excerpted and assignee name", async () => {
    await createTicketRow({ title: "Detail one", statusSlug: "in-progress", labels: ["Bug"] });

    const res = await app.request("/api/mcp/tickets/TEST-1", { method: "GET", headers: { Cookie: cookies } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ticket.ref).toBe("TEST-1");
    expect(body.ticket.status).toBe("In Progress");
    expect(body.ticket.labels).toEqual(["Bug"]);
    expect(body.ticket.reporter).toBe("Test User");
    expect(body.ticket.assignee).toBeNull();
    expect(body.ticket).not.toHaveProperty("comments");
  });

  it("truncates long descriptions to 200 chars", async () => {
    const status = await statusBySlug("backlog");
    const long = "lorem ipsum ".repeat(60);
    await app.request("/api/projects/TEST/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ title: "Long", description: long, statusID: status.id }),
    });

    const res = await app.request("/api/mcp/tickets/TEST-1", { method: "GET", headers: { Cookie: cookies } });
    const body = await res.json();
    expect(body.ticket.description.length).toBeLessThanOrEqual(204);
    expect(body.ticket.description.endsWith("...")).toBe(true);
  });

  it("returns 404 for an unknown ref", async () => {
    const res = await app.request("/api/mcp/tickets/TEST-999", { method: "GET", headers: { Cookie: cookies } });
    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed ref", async () => {
    const res = await app.request("/api/mcp/tickets/not-a-ref", { method: "GET", headers: { Cookie: cookies } });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/mcp/tickets/:ref", () => {
  beforeEach(setupProject);

  it("patches status, priority, labels, and assignee in one call", async () => {
    await createTicketRow();

    const res = await app.request("/api/mcp/tickets/TEST-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ statusSlug: "in-review", priority: "high", labels: ["Bug", "Improvement"], assignee: "Test User" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ticket.status).toBe("In Review");
    expect(body.ticket.priority).toBe("high");
    expect(body.ticket.labels).toEqual(["Bug", "Improvement"]);
  });

  it("clears the assignee when assignee is null", async () => {
    await createTicketRow();
    await app.request("/api/mcp/tickets/TEST-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ assignee: "Test User" }),
    });

    const res = await app.request("/api/mcp/tickets/TEST-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ assignee: null }),
    });

    expect(res.status).toBe(200);
    const detail = await app.request("/api/mcp/tickets/TEST-1", { method: "GET", headers: { Cookie: cookies } });
    const body = await detail.json();
    expect(body.ticket.assignee).toBeNull();
  });

  it("returns 400 for an unknown status slug", async () => {
    await createTicketRow();
    const res = await app.request("/api/mcp/tickets/TEST-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ statusSlug: "nope" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/mcp/tickets/bulk", () => {
  beforeEach(setupProject);

  it("applies the patch to every ref", async () => {
    await createTicketRow({ title: "One" });
    await createTicketRow({ title: "Two" });
    await createTicketRow({ title: "Three" });

    const res = await app.request("/api/mcp/tickets/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ refs: ["TEST-1", "TEST-2", "TEST-3"], patch: { priority: "critical" } }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated).toBe(3);

    const rows = await db.select({ priority: tickets.priority }).from(tickets).where(and(eq(tickets.projectID, projectID), isNull(tickets.deletedAt)));
    expect(rows.every((row) => row.priority === "critical")).toBe(true);
  });

  it("returns 404 when any ref is unknown and mutates nothing", async () => {
    await createTicketRow({ title: "One" });
    await createTicketRow({ title: "Two" });

    const res = await app.request("/api/mcp/tickets/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ refs: ["TEST-1", "TEST-2", "TEST-999"], patch: { priority: "critical" } }),
    });

    expect(res.status).toBe(404);
    const rows = await db.select({ priority: tickets.priority }).from(tickets).where(and(eq(tickets.projectID, projectID), isNull(tickets.deletedAt)));
    expect(rows.every((row) => row.priority === "medium")).toBe(true);
  });

  it("adds labels with addLabels without replacing existing labels", async () => {
    await createTicketRow({ title: "One", labels: ["Bug"] });

    const res = await app.request("/api/mcp/tickets/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ refs: ["TEST-1"], patch: { addLabels: ["Feature"] } }),
    });

    expect(res.status).toBe(200);
    const detail = await app.request("/api/mcp/tickets/TEST-1", { method: "GET", headers: { Cookie: cookies } });
    const body = await detail.json();
    expect(body.ticket.labels).toEqual(["Bug", "Feature"]);
  });

  it("returns 400 when combining labels with addLabels/removeLabels", async () => {
    await createTicketRow({ title: "One" });
    const res = await app.request("/api/mcp/tickets/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ refs: ["TEST-1"], patch: { labels: ["Bug"], addLabels: ["Feature"] } }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/mcp/tickets/:ref/comments", () => {
  beforeEach(setupProject);

  it("adds a comment and returns its id", async () => {
    await createTicketRow();
    const res = await app.request("/api/mcp/tickets/TEST-1/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ body: "looks good" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.commentID).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("GET /api/mcp/tickets/:ref/comments", () => {
  beforeEach(setupProject);

  it("returns live comments in chronological order", async () => {
    await createTicketRow();
    await app.request("/api/mcp/tickets/TEST-1/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ body: "first" }),
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await app.request("/api/mcp/tickets/TEST-1/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ body: "second" }),
    });

    const res = await app.request("/api/mcp/tickets/TEST-1/comments", { method: "GET", headers: { Cookie: cookies } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.comments.map((c: { body: string }) => c.body)).toEqual(["first", "second"]);
    expect(body.comments[0].by).toBe("Test User");
    expect(body.comments[0].edited).toBe(false);
  });

  it("excludes soft-deleted comments", async () => {
    await createTicketRow();
    const created = await app.request("/api/mcp/tickets/TEST-1/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ body: "to be deleted" }),
    });
    const { commentID } = await created.json();

    await app.request(`/api/projects/TEST/tickets/1/comments/${commentID}`, { method: "DELETE", headers: { Cookie: cookies } });

    const res = await app.request("/api/mcp/tickets/TEST-1/comments", { method: "GET", headers: { Cookie: cookies } });
    const body = await res.json();
    expect(body.comments).toEqual([]);
  });
});

describe("GET /api/mcp/activity", () => {
  beforeEach(setupProject);

  it("returns recent activity with stringified old/new values", async () => {
    await createTicketRow();
    await app.request("/api/mcp/tickets/TEST-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ priority: "high" }),
    });

    const res = await app.request("/api/mcp/activity?project=TEST", { method: "GET", headers: { Cookie: cookies } });
    expect(res.status).toBe(200);
    const body = await res.json();
    const priorityChange = body.activity.find((row: { field: string | null }) => row.field === "priority");
    expect(priorityChange).toBeDefined();
    expect(priorityChange.oldValue).toBe("medium");
    expect(priorityChange.newValue).toBe("high");
    expect(priorityChange.ref).toBe("TEST-1");
    expect(priorityChange.by).toBe("Test User");
  });

  it("returns 400 when project is omitted", async () => {
    const res = await app.request("/api/mcp/activity", { method: "GET", headers: { Cookie: cookies } });
    expect(res.status).toBe(400);
  });

  it("caps limit at 100", async () => {
    const res = await app.request("/api/mcp/activity?project=TEST&limit=200", { method: "GET", headers: { Cookie: cookies } });
    expect(res.status).toBe(400);
  });
});

describe("MCP routes via bearer token", () => {
  beforeEach(setupProject);

  it("authenticates with a valid bearer token", async () => {
    const { token } = await createTokenForUser(userID);
    const res = await app.request("/api/mcp/projects", { method: "GET", headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.projects).toEqual([{ key: "TEST", name: "Test Project" }]);
  });

  it("rejects an expired bearer token", async () => {
    const { token } = await createTokenForUser(userID, { expiresAt: new Date(Date.now() - 1000) });
    const res = await app.request("/api/mcp/projects", { method: "GET", headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(401);
  });
});
