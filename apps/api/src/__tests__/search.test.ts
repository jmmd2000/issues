import { describe, it, expect, beforeEach } from "vitest";
import { and, eq } from "drizzle-orm";
import app from "../index";
import { db } from "../db";
import { labels, projectMembers, statuses, tickets } from "../db/schema";
import { createAuthenticatedUser, createExtraUser, createProject, resetDatabase } from "./helpers";

let cookies: string;
let projectID: string;
let statusID: string;

async function getStatusID(projectID: string, slug: string): Promise<string> {
  const [row] = await db
    .select({ id: statuses.id })
    .from(statuses)
    .where(and(eq(statuses.projectID, projectID), eq(statuses.slug, slug)))
    .limit(1);
  return row.id;
}

async function getLabelID(projectID: string, name: string): Promise<string> {
  const [row] = await db
    .select({ id: labels.id })
    .from(labels)
    .where(and(eq(labels.projectID, projectID), eq(labels.name, name)))
    .limit(1);
  return row.id;
}

async function createTicket(
  projectKey = "TEST",
  overrides: Partial<{
    title: string;
    description: string;
    statusID: string;
    priority: string;
    assigneeID: string;
    labelIDs: string[];
    visibility: "public" | "private";
  }> = {},
  authCookies = cookies
) {
  const res = await app.request(`/api/projects/${projectKey}/tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: authCookies },
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

async function setTicketTimes(ticketID: string, times: { createdAt: Date; updatedAt: Date }): Promise<void> {
  await db.update(tickets).set(times).where(eq(tickets.id, ticketID));
}

function highlightedText(parts: Array<{ text: string; highlighted: boolean }>) {
  return parts.filter((part) => part.highlighted).map((part) => part.text);
}

describe("GET /api/search", () => {
  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
    const project = await createProject(cookies);
    projectID = project.id;
    statusID = await getStatusID(projectID, "backlog");
  });

  it("matches text across title and description and returns highlight parts", async () => {
    await createTicket("TEST", { title: "Login fails on Safari", description: "No matching word here." });
    await createTicket("TEST", { title: "Browser-specific issue", description: "The login button does nothing after submit." });
    await createTicket("TEST", { title: "Unrelated", description: "Other copy." });

    const res = await app.request("/api/search?q=login", { headers: { Cookie: cookies } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.tickets).toHaveLength(2);
    expect(body.tickets.map((ticket: { title: string }) => ticket.title).sort()).toEqual(["Browser-specific issue", "Login fails on Safari"]);

    const titleMatch = body.tickets.find((ticket: { title: string }) => ticket.title === "Login fails on Safari");
    expect(highlightedText(titleMatch.highlights.title)).toEqual(["Login"]);

    const descriptionMatch = body.tickets.find((ticket: { title: string }) => ticket.title === "Browser-specific issue");
    expect(highlightedText(descriptionMatch.highlights.description).join(" ").toLowerCase()).toContain("login");
  });

  it("orders text results by rank before updated time", async () => {
    await createTicket("TEST", { title: "Authentication note", description: "authentication" });
    await createTicket("TEST", { title: "Authentication authentication authentication", description: "authentication authentication" });

    const res = await app.request("/api/search?q=authentication&sortBy=relevance", { headers: { Cookie: cookies } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.tickets[0].title).toBe("Authentication authentication authentication");
  });

  it("supports websearch syntax for phrases, exclusions, and or", async () => {
    await createTicket("TEST", { title: "Exact phrase lives here", description: "Plain text." });
    await createTicket("TEST", { title: "Exact words are separated from phrase", description: "Plain text." });
    await createTicket("TEST", { title: "Login included", description: "Allowed result." });
    await createTicket("TEST", { title: "Login excluded", description: "excluded result." });
    await createTicket("TEST", { title: "Alpha request", description: "Plain text." });
    await createTicket("TEST", { title: "Beta request", description: "Plain text." });

    const phraseRes = await app.request("/api/search?q=%22exact%20phrase%22", { headers: { Cookie: cookies } });
    expect(phraseRes.status).toBe(200);
    const phraseBody = await phraseRes.json();
    expect(phraseBody.tickets.map((ticket: { title: string }) => ticket.title)).toContain("Exact phrase lives here");
    expect(phraseBody.tickets.map((ticket: { title: string }) => ticket.title)).not.toContain("Exact words are separated from phrase");

    const excludedRes = await app.request("/api/search?q=login%20-excluded", { headers: { Cookie: cookies } });
    expect(excludedRes.status).toBe(200);
    const excludedBody = await excludedRes.json();
    expect(excludedBody.tickets.map((ticket: { title: string }) => ticket.title)).toEqual(["Login included"]);

    const orRes = await app.request("/api/search?q=alpha%20or%20beta", { headers: { Cookie: cookies } });
    expect(orRes.status).toBe(200);
    const orBody = await orRes.json();
    expect(orBody.tickets.map((ticket: { title: string }) => ticket.title).sort()).toEqual(["Alpha request", "Beta request"]);
  });

  it("combines project, status, priority, label, and assignee filters", async () => {
    const { user: assignee } = await createExtraUser("Assignee", "assignee@test.com");
    const doneStatusID = await getStatusID(projectID, "done");
    const bugLabelID = await getLabelID(projectID, "Bug");

    const project = await createProject(cookies, { key: "OTHER", name: "Other Project" });
    const otherStatusID = await getStatusID(project.id, "done");

    const matching = await createTicket("TEST", {
      title: "Filtered login bug",
      description: "Authentication filter target.",
      statusID: doneStatusID,
      priority: "high",
      assigneeID: assignee.id,
      labelIDs: [bugLabelID],
    });
    await createTicket("TEST", { title: "Wrong priority login bug", description: "Authentication filter target.", statusID: doneStatusID, priority: "low", assigneeID: assignee.id, labelIDs: [bugLabelID] });
    await createTicket("OTHER", { title: "Wrong project login bug", description: "Authentication filter target.", statusID: otherStatusID, priority: "high" });

    const res = await app.request(`/api/search?q=authentication&project=TEST&status=done&priority=high&label=Bug&assignee=${assignee.id}`, {
      headers: { Cookie: cookies },
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.tickets).toHaveLength(1);
    expect(body.tickets[0].id).toBe(matching.id);
    expect(body.tickets[0].labels.map((label: { name: string }) => label.name)).toEqual(["Bug"]);
  });

  it("returns empty-query filtered results by updated time", async () => {
    await createTicket("TEST", { title: "Low", priority: "low" });
    await createTicket("TEST", { title: "High one", priority: "high" });
    await createTicket("TEST", { title: "High two", priority: "high" });

    const res = await app.request("/api/search?priority=high", { headers: { Cookie: cookies } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.tickets.map((ticket: { title: string }) => ticket.title)).toEqual(["High two", "High one"]);
    expect(body.tickets.every((ticket: { highlights: { title: Array<{ highlighted: boolean }> } }) => ticket.highlights.title.every((part) => !part.highlighted))).toBe(true);
  });

  it("sorts results by updated time in both directions", async () => {
    const oldest = await createTicket("TEST", { title: "Oldest update" });
    const newest = await createTicket("TEST", { title: "Newest update" });

    await setTicketTimes(oldest.id, {
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-03T00:00:00.000Z"),
    });
    await setTicketTimes(newest.id, {
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      updatedAt: new Date("2026-01-05T00:00:00.000Z"),
    });

    const ascendingRes = await app.request("/api/search?sortBy=updatedAt&sortDirection=asc", { headers: { Cookie: cookies } });
    expect(ascendingRes.status).toBe(200);
    const ascendingBody = await ascendingRes.json();
    expect(ascendingBody.tickets.map((ticket: { title: string }) => ticket.title)).toEqual(["Oldest update", "Newest update"]);

    const descendingRes = await app.request("/api/search?sortBy=updatedAt&sortDirection=desc", { headers: { Cookie: cookies } });
    expect(descendingRes.status).toBe(200);
    const descendingBody = await descendingRes.json();
    expect(descendingBody.tickets.map((ticket: { title: string }) => ticket.title)).toEqual(["Newest update", "Oldest update"]);
  });

  it("sorts results by created time in both directions", async () => {
    const first = await createTicket("TEST", { title: "First created" });
    const second = await createTicket("TEST", { title: "Second created" });

    await setTicketTimes(first.id, {
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-05T00:00:00.000Z"),
    });
    await setTicketTimes(second.id, {
      createdAt: new Date("2026-01-04T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    const ascendingRes = await app.request("/api/search?sortBy=createdAt&sortDirection=asc", { headers: { Cookie: cookies } });
    expect(ascendingRes.status).toBe(200);
    const ascendingBody = await ascendingRes.json();
    expect(ascendingBody.tickets.map((ticket: { title: string }) => ticket.title)).toEqual(["First created", "Second created"]);

    const descendingRes = await app.request("/api/search?sortBy=createdAt&sortDirection=desc", { headers: { Cookie: cookies } });
    expect(descendingRes.status).toBe(200);
    const descendingBody = await descendingRes.json();
    expect(descendingBody.tickets.map((ticket: { title: string }) => ticket.title)).toEqual(["Second created", "First created"]);
  });

  it("sorts results by title and defaults title sorting to ascending", async () => {
    await createTicket("TEST", { title: "Beta task" });
    await createTicket("TEST", { title: "Alpha task" });
    await createTicket("TEST", { title: "Gamma task" });

    const defaultDirectionRes = await app.request("/api/search?sortBy=title", { headers: { Cookie: cookies } });
    expect(defaultDirectionRes.status).toBe(200);
    const defaultDirectionBody = await defaultDirectionRes.json();
    expect(defaultDirectionBody.tickets.map((ticket: { title: string }) => ticket.title)).toEqual(["Alpha task", "Beta task", "Gamma task"]);

    const descendingRes = await app.request("/api/search?sortBy=title&sortDirection=desc", { headers: { Cookie: cookies } });
    expect(descendingRes.status).toBe(200);
    const descendingBody = await descendingRes.json();
    expect(descendingBody.tickets.map((ticket: { title: string }) => ticket.title)).toEqual(["Gamma task", "Beta task", "Alpha task"]);
  });

  it("paginates with hasNextPage", async () => {
    for (let i = 1; i <= 26; i += 1) {
      await createTicket("TEST", { title: `Paged result ${i}`, description: "pagination target" });
    }

    const firstRes = await app.request("/api/search?q=pagination&page=1&perPage=25", { headers: { Cookie: cookies } });
    expect(firstRes.status).toBe(200);
    const firstBody = await firstRes.json();
    expect(firstBody.tickets).toHaveLength(25);
    expect(firstBody.hasNextPage).toBe(true);

    const secondRes = await app.request("/api/search?q=pagination&page=2&perPage=25", { headers: { Cookie: cookies } });
    expect(secondRes.status).toBe(200);
    const secondBody = await secondRes.json();
    expect(secondBody.tickets).toHaveLength(1);
    expect(secondBody.hasNextPage).toBe(false);
  });

  it("enforces anonymous and authenticated visibility rules", async () => {
    await createTicket("TEST", { title: "Public visible", description: "visibility target", visibility: "public" });
    await createTicket("TEST", { title: "Private ticket hidden anonymously", description: "visibility target", visibility: "private" });

    const privateProject = await createProject(cookies, { key: "PRIV", name: "Private Project", visibility: "private" });
    const privateStatusID = await getStatusID(privateProject.id, "backlog");
    await createTicket("PRIV", { title: "Private project visible to member", description: "visibility target", statusID: privateStatusID, visibility: "public" });

    const { cookies: otherCookies } = await createExtraUser("Other", "other@test.com");

    const anonymousRes = await app.request("/api/search?q=visibility");
    expect(anonymousRes.status).toBe(200);
    const anonymousBody = await anonymousRes.json();
    expect(anonymousBody.tickets.map((ticket: { title: string }) => ticket.title)).toEqual(["Public visible"]);

    const ownerRes = await app.request("/api/search?q=visibility", { headers: { Cookie: cookies } });
    expect(ownerRes.status).toBe(200);
    const ownerBody = await ownerRes.json();
    expect(ownerBody.tickets.map((ticket: { title: string }) => ticket.title).sort()).toEqual([
      "Private project visible to member",
      "Private ticket hidden anonymously",
      "Public visible",
    ]);

    const otherRes = await app.request("/api/search?q=visibility", { headers: { Cookie: otherCookies } });
    expect(otherRes.status).toBe(200);
    const otherBody = await otherRes.json();
    expect(otherBody.tickets.map((ticket: { title: string }) => ticket.title)).toEqual(["Public visible"]);
  });

  it("rejects invalid priority filters", async () => {
    const res = await app.request("/api/search?priority=urgent", { headers: { Cookie: cookies } });
    expect(res.status).toBe(400);
  });

  it("rejects invalid sort options", async () => {
    const sortByRes = await app.request("/api/search?sortBy=number", { headers: { Cookie: cookies } });
    expect(sortByRes.status).toBe(400);

    const sortDirectionRes = await app.request("/api/search?sortBy=title&sortDirection=sideways", { headers: { Cookie: cookies } });
    expect(sortDirectionRes.status).toBe(400);
  });
});

describe("GET /api/search/filters", () => {
  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
    const project = await createProject(cookies);
    projectID = project.id;
    statusID = await getStatusID(projectID, "backlog");
  });

  it("returns accessible filter options", async () => {
    const { user: assignee } = await createExtraUser("Assignee", "filter-assignee@test.com");
    await db.insert(projectMembers).values({ projectID, userID: assignee.id, role: "member" });

    await createProject(cookies, { key: "PRIV", name: "Private Project", visibility: "private" });
    await createTicket("TEST", { title: "Uses label", assigneeID: assignee.id });

    const res = await app.request("/api/search/filters", { headers: { Cookie: cookies } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.filters.projects.map((project: { key: string }) => project.key).sort()).toEqual(["PRIV", "TEST"]);
    expect(body.filters.statuses.map((status: { slug: string }) => status.slug)).toContain("backlog");
    expect(body.filters.labels.map((label: { name: string }) => label.name)).toContain("Bug");
    expect(body.filters.assignees.map((user: { name: string }) => user.name)).toContain("Assignee");
  });

  it("scopes filter options to a project key", async () => {
    await createProject(cookies, { key: "OTHER", name: "Other Project" });

    const res = await app.request("/api/search/filters?project=TEST", { headers: { Cookie: cookies } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.filters.projects.map((project: { key: string }) => project.key)).toEqual(["TEST"]);
  });
});
