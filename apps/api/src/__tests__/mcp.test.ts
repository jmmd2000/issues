import { describe, it, expect, beforeEach } from "vitest";
import { and, eq } from "drizzle-orm";
import app from "../index";
import { db } from "../db";
import { labels, projectMembers, statuses } from "../db/schema";
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

  it("caps perPage at 50", async () => {
    const res = await app.request("/api/mcp/tickets?project=TEST&perPage=999", { method: "GET", headers: { Cookie: cookies } });
    expect(res.status).toBe(400);
  });

  it("returns total + page + hasNextPage in the response", async () => {
    await createTicketRow({ title: "One" });
    await createTicketRow({ title: "Two" });
    await createTicketRow({ title: "Three" });

    const res = await app.request("/api/mcp/tickets?project=TEST&perPage=2&page=1", { method: "GET", headers: { Cookie: cookies } });
    const body = await res.json();
    expect(body.total).toBe(3);
    expect(body.page).toBe(1);
    expect(body.perPage).toBe(2);
    expect(body.hasNextPage).toBe(true);
    expect(body.tickets).toHaveLength(2);
  });

  it("exposes the `created` field on each result", async () => {
    await createTicketRow();
    const res = await app.request("/api/mcp/tickets?project=TEST", { method: "GET", headers: { Cookie: cookies } });
    const body = await res.json();
    expect(body.tickets[0].created).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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

describe("GET /api/mcp/tickets/:ref full flag", () => {
  beforeEach(setupProject);

  it("excerpts to 200 chars by default and marks descriptionTruncated", async () => {
    const status = await statusBySlug("backlog");
    const long = "lorem ipsum ".repeat(60);
    await app.request("/api/projects/TEST/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ title: "Long", description: long, statusID: status.id }),
    });

    const res = await app.request("/api/mcp/tickets/TEST-1", { method: "GET", headers: { Cookie: cookies } });
    const body = await res.json();
    expect(body.ticket.descriptionTruncated).toBe(true);
    expect(body.ticket.description.length).toBeLessThan(long.length);
  });

  it("returns the full description when full=true", async () => {
    const status = await statusBySlug("backlog");
    const long = "lorem ipsum ".repeat(60);
    await app.request("/api/projects/TEST/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ title: "Long", description: long, statusID: status.id }),
    });

    const res = await app.request("/api/mcp/tickets/TEST-1?full=true", { method: "GET", headers: { Cookie: cookies } });
    const body = await res.json();
    expect(body.ticket.descriptionTruncated).toBe(false);
    expect(body.ticket.description).toBe(long);
  });
});

describe("PATCH /api/mcp/tickets/:ref label deltas", () => {
  beforeEach(setupProject);

  it("adds labels with addLabels without replacing existing ones", async () => {
    await createTicketRow({ labels: ["Bug"] });

    const res = await app.request("/api/mcp/tickets/TEST-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ addLabels: ["Feature"] }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ticket.labels).toEqual(["Bug", "Feature"]);
  });

  it("removes labels with removeLabels", async () => {
    await createTicketRow({ labels: ["Bug", "Feature"] });

    const res = await app.request("/api/mcp/tickets/TEST-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ removeLabels: ["Bug"] }),
    });

    const body = await res.json();
    expect(body.ticket.labels).toEqual(["Feature"]);
  });

  it("returns 400 when combining labels with addLabels", async () => {
    await createTicketRow();
    const res = await app.request("/api/mcp/tickets/TEST-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ labels: ["Bug"], addLabels: ["Feature"] }),
    });
    expect(res.status).toBe(400);
  });
});

describe("PATCH/DELETE /api/mcp/comments/:id", () => {
  beforeEach(setupProject);

  async function seedComment(): Promise<string> {
    await createTicketRow();
    const res = await app.request("/api/mcp/tickets/TEST-1/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ body: "original" }),
    });
    const body = await res.json();
    return body.commentID;
  }

  it("edits a comment by id", async () => {
    const id = await seedComment();
    const res = await app.request(`/api/mcp/comments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ body: "edited" }),
    });
    expect(res.status).toBe(200);

    const list = await app.request("/api/mcp/tickets/TEST-1/comments", { method: "GET", headers: { Cookie: cookies } });
    const body = await list.json();
    expect(body.comments[0].body).toBe("edited");
    expect(body.comments[0].edited).toBe(true);
  });

  it("deletes a comment by id", async () => {
    const id = await seedComment();
    const res = await app.request(`/api/mcp/comments/${id}`, { method: "DELETE", headers: { Cookie: cookies } });
    expect(res.status).toBe(204);

    const list = await app.request("/api/mcp/tickets/TEST-1/comments", { method: "GET", headers: { Cookie: cookies } });
    const body = await list.json();
    expect(body.comments).toEqual([]);
  });

  it("returns 404 for an unknown comment id", async () => {
    const res = await app.request("/api/mcp/comments/00000000-0000-0000-0000-000000000000", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ body: "x" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/mcp/tickets/:ref/attachments", () => {
  beforeEach(setupProject);

  it("returns empty for a ticket with no attachments", async () => {
    await createTicketRow();
    const res = await app.request("/api/mcp/tickets/TEST-1/attachments", { method: "GET", headers: { Cookie: cookies } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.attachments).toEqual([]);
  });
});

describe("DELETE /api/mcp/tickets/:ref/links auto-direction", () => {
  beforeEach(setupProject);

  it("removes a link addressed from the target side", async () => {
    await createTicketRow({ title: "Source" });
    await createTicketRow({ title: "Target" });
    await app.request("/api/mcp/tickets/TEST-1/links", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ target: "TEST-2", linkType: "blocks" }),
    });

    // Address removal from the target side; canonical row stored on TEST-1.
    const res = await app.request("/api/mcp/tickets/TEST-2/links?target=TEST-1&linkType=blocks", { method: "DELETE", headers: { Cookie: cookies } });
    expect(res.status).toBe(204);

    const list = await app.request("/api/mcp/tickets/TEST-1/links", { method: "GET", headers: { Cookie: cookies } });
    const body = await list.json();
    expect(body.links).toEqual([]);
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

describe("GET /api/mcp/projects/:key", () => {
  beforeEach(setupProject);

  it("returns the project with members, statuses, and labels", async () => {
    const res = await app.request("/api/mcp/projects/TEST", { method: "GET", headers: { Cookie: cookies } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.project.key).toBe("TEST");
    expect(body.project.members).toContainEqual({ name: "Test User", email: "test@test.com", role: "owner" });
    expect(body.project.statuses.map((status: { slug: string }) => status.slug)).toContain("in-progress");
    expect(body.project.labels.map((label: { name: string }) => label.name)).toContain("Bug");
  });

  it("returns 404 for a project the user is not a member of", async () => {
    const other = await createExtraUser("Other", "other@test.com");
    await createProject(other.cookies, { key: "OTHER", visibility: "private" });
    const res = await app.request("/api/mcp/projects/OTHER", { method: "GET", headers: { Cookie: cookies } });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/mcp/projects/:key/members", () => {
  beforeEach(setupProject);

  it("returns just the member list", async () => {
    const res = await app.request("/api/mcp/projects/TEST/members", { method: "GET", headers: { Cookie: cookies } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.members).toEqual([{ name: "Test User", email: "test@test.com", role: "owner" }]);
  });
});

describe("GET /api/mcp/projects/:key/statuses", () => {
  beforeEach(setupProject);

  it("returns statuses ordered by category then name", async () => {
    const res = await app.request("/api/mcp/projects/TEST/statuses", { method: "GET", headers: { Cookie: cookies } });
    expect(res.status).toBe(200);
    const body = await res.json();
    const categories = body.statuses.map((status: { category: string }) => status.category);
    expect(categories.indexOf("backlog")).toBeLessThan(categories.indexOf("active"));
    expect(categories.indexOf("active")).toBeLessThan(categories.indexOf("done"));
  });
});

describe("GET /api/mcp/projects/:key/labels", () => {
  beforeEach(setupProject);

  it("returns labels alphabetised", async () => {
    const res = await app.request("/api/mcp/projects/TEST/labels", { method: "GET", headers: { Cookie: cookies } });
    expect(res.status).toBe(200);
    const body = await res.json();
    const names = body.labels.map((label: { name: string }) => label.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});

describe("GET /api/mcp/projects/:key/stats", () => {
  beforeEach(setupProject);

  it("returns total / open / closed counts and per-member breakdown keyed by name", async () => {
    await createTicketRow({ title: "One" });
    await createTicketRow({ title: "Two", statusSlug: "done" });

    const res = await app.request("/api/mcp/projects/TEST/stats", { method: "GET", headers: { Cookie: cookies } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stats.total).toBe(2);
    expect(body.stats.open).toBe(1);
    expect(body.stats.closed).toBe(1);
    expect(body.stats.byMember).toHaveProperty("Test User");
    expect(body.stats.byMember["Test User"].reported).toBe(2);
  });
});

describe("GET /api/mcp/tickets sort", () => {
  beforeEach(setupProject);

  it("sorts by title ascending when sortBy=title", async () => {
    await createTicketRow({ title: "Charlie" });
    await createTicketRow({ title: "Alpha" });
    await createTicketRow({ title: "Bravo" });

    const res = await app.request("/api/mcp/tickets?project=TEST&sortBy=title&sortDirection=asc", { method: "GET", headers: { Cookie: cookies } });
    const body = await res.json();
    expect(body.tickets.map((t: { title: string }) => t.title)).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("returns the most recent N when sortBy=updatedAt with perPage", async () => {
    await createTicketRow({ title: "First" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await createTicketRow({ title: "Second" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await createTicketRow({ title: "Third" });

    const res = await app.request("/api/mcp/tickets?project=TEST&sortBy=updatedAt&sortDirection=desc&perPage=2", { method: "GET", headers: { Cookie: cookies } });
    const body = await res.json();
    expect(body.tickets.map((t: { title: string }) => t.title)).toEqual(["Third", "Second"]);
  });

  it("rejects an unknown sortBy", async () => {
    const res = await app.request("/api/mcp/tickets?project=TEST&sortBy=nope", { method: "GET", headers: { Cookie: cookies } });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/mcp/tickets/:ref", () => {
  beforeEach(setupProject);

  it("soft-deletes the ticket", async () => {
    await createTicketRow();
    const res = await app.request("/api/mcp/tickets/TEST-1", { method: "DELETE", headers: { Cookie: cookies } });
    expect(res.status).toBe(200);

    const detail = await app.request("/api/mcp/tickets/TEST-1", { method: "GET", headers: { Cookie: cookies } });
    expect(detail.status).toBe(404);
  });

  it("returns 404 for a non-existent ticket", async () => {
    const res = await app.request("/api/mcp/tickets/TEST-999", { method: "DELETE", headers: { Cookie: cookies } });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/mcp/tickets/:ref/restore", () => {
  beforeEach(setupProject);

  it("restores a soft-deleted ticket", async () => {
    await createTicketRow();
    await app.request("/api/mcp/tickets/TEST-1", { method: "DELETE", headers: { Cookie: cookies } });

    const res = await app.request("/api/mcp/tickets/TEST-1/restore", { method: "POST", headers: { Cookie: cookies } });
    expect(res.status).toBe(200);

    const detail = await app.request("/api/mcp/tickets/TEST-1", { method: "GET", headers: { Cookie: cookies } });
    expect(detail.status).toBe(200);
  });

  it("returns 404 if the ticket is not in the trash", async () => {
    await createTicketRow();
    const res = await app.request("/api/mcp/tickets/TEST-1/restore", { method: "POST", headers: { Cookie: cookies } });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/mcp/tickets/:ref/clone", () => {
  beforeEach(setupProject);

  it("clones the source ticket with overrides applied", async () => {
    await createTicketRow({ title: "Source", priority: "high", labels: ["Bug"] });

    const res = await app.request("/api/mcp/tickets/TEST-1/clone", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ title: "Clone" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ticket.title).toBe("Clone");
    expect(body.ticket.priority).toBe("high");
    expect(body.ticket.labels).toEqual(["Bug"]);
    expect(body.ticket.ref).toBe("TEST-2");
  });

  it("returns 400 for an unknown statusSlug override", async () => {
    await createTicketRow();
    const res = await app.request("/api/mcp/tickets/TEST-1/clone", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ title: "x", statusSlug: "nope" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/mcp/tickets/:ref/activity", () => {
  beforeEach(setupProject);

  it("returns only activity for the requested ticket", async () => {
    await createTicketRow({ title: "Watched" });
    await createTicketRow({ title: "Ignored" });
    await app.request("/api/mcp/tickets/TEST-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ priority: "high" }),
    });

    const res = await app.request("/api/mcp/tickets/TEST-1/activity", { method: "GET", headers: { Cookie: cookies } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activity.every((row: { ref: string }) => row.ref === "TEST-1")).toBe(true);
    expect(body.activity.some((row: { field: string | null }) => row.field === "priority")).toBe(true);
  });
});

describe("ticket links", () => {
  beforeEach(setupProject);

  it("adds a link, lists it, and removes it", async () => {
    await createTicketRow({ title: "Source" });
    await createTicketRow({ title: "Target" });

    const add = await app.request("/api/mcp/tickets/TEST-1/links", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ target: "TEST-2", linkType: "blocks" }),
    });
    expect(add.status).toBe(201);
    const addBody = await add.json();
    expect(addBody.link).toEqual({ ref: "TEST-2", title: "Target", status: "Backlog", linkType: "blocks", direction: "outgoing" });

    const list = await app.request("/api/mcp/tickets/TEST-1/links", { method: "GET", headers: { Cookie: cookies } });
    const listBody = await list.json();
    expect(listBody.links).toHaveLength(1);
    expect(listBody.links[0].direction).toBe("outgoing");

    const remove = await app.request("/api/mcp/tickets/TEST-1/links?target=TEST-2&linkType=blocks", { method: "DELETE", headers: { Cookie: cookies } });
    expect(remove.status).toBe(204);

    const after = await app.request("/api/mcp/tickets/TEST-1/links", { method: "GET", headers: { Cookie: cookies } });
    const afterBody = await after.json();
    expect(afterBody.links).toEqual([]);
  });

  it("shows the inverse direction from the target side", async () => {
    await createTicketRow({ title: "Source" });
    await createTicketRow({ title: "Target" });
    await app.request("/api/mcp/tickets/TEST-1/links", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ target: "TEST-2", linkType: "blocks" }),
    });

    const res = await app.request("/api/mcp/tickets/TEST-2/links", { method: "GET", headers: { Cookie: cookies } });
    const body = await res.json();
    expect(body.links).toHaveLength(1);
    expect(body.links[0].direction).toBe("incoming");
    expect(body.links[0].ref).toBe("TEST-1");
  });

  it("returns 409 when adding a duplicate link", async () => {
    await createTicketRow({ title: "Source" });
    await createTicketRow({ title: "Target" });
    await app.request("/api/mcp/tickets/TEST-1/links", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ target: "TEST-2", linkType: "blocks" }),
    });

    const res = await app.request("/api/mcp/tickets/TEST-1/links", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ target: "TEST-2", linkType: "blocks" }),
    });
    expect(res.status).toBe(409);
  });

  it("returns 404 when removing a link that does not exist", async () => {
    await createTicketRow({ title: "Source" });
    await createTicketRow({ title: "Target" });
    const res = await app.request("/api/mcp/tickets/TEST-1/links?target=TEST-2&linkType=blocks", { method: "DELETE", headers: { Cookie: cookies } });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/mcp/tickets parentTicketRef", () => {
  beforeEach(setupProject);

  it("creates a ticket with a parent ref in the same project", async () => {
    await createTicketRow({ title: "Parent" });

    const res = await app.request("/api/mcp/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ project: "TEST", title: "Child", parentTicketRef: "TEST-1" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ticket.ref).toBe("TEST-2");

    const parentRes = await app.request("/api/projects/TEST/tickets/1", { headers: { Cookie: cookies } });
    const parentBody = await parentRes.json();
    expect(parentBody.ticket.children.map((c: { title: string }) => c.title)).toEqual(["Child"]);
  });

  it("ignores parentTicketRef when set to null on create", async () => {
    const res = await app.request("/api/mcp/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ project: "TEST", title: "Lone", parentTicketRef: null }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    const detail = await app.request(`/api/projects/TEST/tickets/${body.ticket.ref.split("-")[1]}`, { headers: { Cookie: cookies } });
    const detailBody = await detail.json();
    expect(detailBody.ticket.parent).toBeNull();
  });

  it("returns 404 for an unknown parent ref", async () => {
    const res = await app.request("/api/mcp/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ project: "TEST", title: "Child", parentTicketRef: "TEST-999" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed parent ref", async () => {
    const res = await app.request("/api/mcp/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ project: "TEST", title: "Child", parentTicketRef: "not-a-ref" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when the parent is in a different project", async () => {
    const other = await createExtraUser("Other Owner", "other-owner@test.com");
    const otherProject = await createProject(other.cookies, { key: "OTHR", name: "Other Project" });
    await db.insert(projectMembers).values({ projectID: otherProject.id, userID, role: "member" });

    const otherStatus = await db.select().from(statuses).where(and(eq(statuses.projectID, otherProject.id), eq(statuses.slug, "backlog"))).limit(1);
    await app.request("/api/projects/OTHR/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ title: "Foreign parent", statusID: otherStatus[0].id }),
    });

    const res = await app.request("/api/mcp/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ project: "TEST", title: "Child", parentTicketRef: "OTHR-1" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/mcp/tickets/:ref parentTicketRef", () => {
  beforeEach(setupProject);

  it("sets a parent on an existing ticket", async () => {
    await createTicketRow({ title: "Parent" });
    await createTicketRow({ title: "Orphan" });

    const res = await app.request("/api/mcp/tickets/TEST-2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ parentTicketRef: "TEST-1" }),
    });
    expect(res.status).toBe(200);

    const detail = await app.request("/api/projects/TEST/tickets/2", { headers: { Cookie: cookies } });
    const body = await detail.json();
    expect(body.ticket.parent).toMatchObject({ number: 1 });
  });

  it("clears the parent when parentTicketRef is null", async () => {
    await createTicketRow({ title: "Parent" });
    await createTicketRow({ title: "Child" });
    await app.request("/api/mcp/tickets/TEST-2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ parentTicketRef: "TEST-1" }),
    });

    const res = await app.request("/api/mcp/tickets/TEST-2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ parentTicketRef: null }),
    });
    expect(res.status).toBe(200);

    const detail = await app.request("/api/projects/TEST/tickets/2", { headers: { Cookie: cookies } });
    const body = await detail.json();
    expect(body.ticket.parent).toBeNull();
  });

  it("returns 400 when the patch would form a cycle", async () => {
    await createTicketRow({ title: "A" });
    await createTicketRow({ title: "B" });
    await app.request("/api/mcp/tickets/TEST-2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ parentTicketRef: "TEST-1" }),
    });

    // A -> B exists. Trying to set B as A's parent forms cycle A -> B -> A.
    const res = await app.request("/api/mcp/tickets/TEST-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ parentTicketRef: "TEST-2" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when the parent is in a different project", async () => {
    await createTicketRow({ title: "Child" });
    const other = await createExtraUser("Other Owner 2", "other-owner-2@test.com");
    const otherProject = await createProject(other.cookies, { key: "OTHR", name: "Other Project" });
    await db.insert(projectMembers).values({ projectID: otherProject.id, userID, role: "member" });
    const otherStatus = await db.select().from(statuses).where(and(eq(statuses.projectID, otherProject.id), eq(statuses.slug, "backlog"))).limit(1);
    await app.request("/api/projects/OTHR/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ title: "Foreign parent", statusID: otherStatus[0].id }),
    });

    const res = await app.request("/api/mcp/tickets/TEST-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ parentTicketRef: "OTHR-1" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for a malformed parent ref", async () => {
    await createTicketRow();
    const res = await app.request("/api/mcp/tickets/TEST-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ parentTicketRef: "garbage" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown parent ref", async () => {
    await createTicketRow();
    const res = await app.request("/api/mcp/tickets/TEST-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ parentTicketRef: "TEST-999" }),
    });
    expect(res.status).toBe(404);
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
