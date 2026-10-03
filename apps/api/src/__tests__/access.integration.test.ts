import { beforeEach, describe, expect, it } from "vitest";
import app from "../index";
import { db } from "../db";
import { statuses } from "../db/schema";
import { and, eq } from "drizzle-orm";
import { createAuthenticatedUser, createExtraUser, createProject, createServiceUser, createTokenForUser, resetDatabase } from "./helpers";

type Viewer = "anon" | "nonMember" | "member" | "service";

type Fixture = {
  memberCookies: string;
  nonMemberCookies: string;
  serviceToken: string;
  pubProjectID: string;
  pubPublicTicket: { id: string; number: number };
  pubPrivateTicket: { id: string; number: number };
  privProjectID: string;
  privTicket: { id: string; number: number };
};

let fixture: Fixture;

async function statusIDFor(projectID: string): Promise<string> {
  const [row] = await db
    .select({ id: statuses.id })
    .from(statuses)
    .where(and(eq(statuses.projectID, projectID), eq(statuses.slug, "backlog")))
    .limit(1);
  return row.id;
}

async function createTicket(cookies: string, projectKey: string, title: string, visibility: "public" | "private", statusID: string) {
  const res = await app.request(`/api/projects/${projectKey}/tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookies },
    body: JSON.stringify({ title, description: "", statusID, visibility }),
  });
  const body = await res.json();
  return body.ticket as { id: string; number: number };
}

async function addComment(cookies: string, projectKey: string, num: number, body: string) {
  await app.request(`/api/projects/${projectKey}/tickets/${num}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookies },
    body: JSON.stringify({ body }),
  });
}

function viewerInit(viewer: Viewer): RequestInit {
  if (viewer === "anon") return {};
  if (viewer === "service") return { headers: { Authorization: `Bearer ${fixture.serviceToken}` } };
  const cookies = viewer === "member" ? fixture.memberCookies : fixture.nonMemberCookies;
  return { headers: { Cookie: cookies } };
}

beforeEach(async () => {
  await resetDatabase();

  const { cookies: memberCookies } = await createAuthenticatedUser("Owner", "owner@test.com");
  const { cookies: nonMemberCookies } = await createExtraUser("Outsider", "outsider@test.com");
  const { user: serviceUser } = await createServiceUser("Bot");
  const { token: serviceToken } = await createTokenForUser(serviceUser.id);

  const pubProject = await createProject(memberCookies, { key: "PUB", visibility: "public" });
  const privProject = await createProject(memberCookies, { key: "PRIV", visibility: "private" });

  const pubStatusID = await statusIDFor(pubProject.id);
  const privStatusID = await statusIDFor(privProject.id);

  const pubPublicTicket = await createTicket(memberCookies, "PUB", "Public ticket text", "public", pubStatusID);
  const pubPrivateTicket = await createTicket(memberCookies, "PUB", "Private ticket text", "private", pubStatusID);
  const privTicket = await createTicket(memberCookies, "PRIV", "Private project ticket", "public", privStatusID);

  // Seed at least one comment on each ticket so list endpoints have data
  await addComment(memberCookies, "PUB", pubPublicTicket.number, "Hello on public");
  await addComment(memberCookies, "PUB", pubPrivateTicket.number, "Hello on private");
  await addComment(memberCookies, "PRIV", privTicket.number, "Hello on priv");

  fixture = {
    memberCookies,
    nonMemberCookies,
    serviceToken,
    pubProjectID: pubProject.id,
    pubPublicTicket,
    pubPrivateTicket,
    privProjectID: privProject.id,
    privTicket,
  };
});

describe("access matrix: project detail GET /api/projects/:key", () => {
  it("anon sees public project, 404s on private", async () => {
    const pub = await app.request("/api/projects/PUB", viewerInit("anon"));
    expect(pub.status).toBe(200);
    const priv = await app.request("/api/projects/PRIV", viewerInit("anon"));
    expect(priv.status).toBe(404);
  });

  it("non-member sees public project, 404s on private", async () => {
    const pub = await app.request("/api/projects/PUB", viewerInit("nonMember"));
    expect(pub.status).toBe(200);
    const priv = await app.request("/api/projects/PRIV", viewerInit("nonMember"));
    expect(priv.status).toBe(404);
  });

  it("member sees both projects", async () => {
    const pub = await app.request("/api/projects/PUB", viewerInit("member"));
    expect(pub.status).toBe(200);
    const priv = await app.request("/api/projects/PRIV", viewerInit("member"));
    expect(priv.status).toBe(200);
  });

  it("service user sees both projects", async () => {
    const pub = await app.request("/api/projects/PUB", viewerInit("service"));
    expect(pub.status).toBe(200);
    const priv = await app.request("/api/projects/PRIV", viewerInit("service"));
    expect(priv.status).toBe(200);
  });
});

describe("access matrix: ticket list GET /api/projects/:key/tickets", () => {
  it("anon sees public tickets only on public project, 404 on private project", async () => {
    const pub = await app.request("/api/projects/PUB/tickets", viewerInit("anon"));
    expect(pub.status).toBe(200);
    const pubBody = await pub.json();
    const titles = pubBody.tickets.map((t: { title: string }) => t.title);
    expect(titles).toContain("Public ticket text");
    expect(titles).not.toContain("Private ticket text");

    const priv = await app.request("/api/projects/PRIV/tickets", viewerInit("anon"));
    expect(priv.status).toBe(404);
  });

  it("non-member sees public tickets only on public project, 404 on private project", async () => {
    const pub = await app.request("/api/projects/PUB/tickets", viewerInit("nonMember"));
    expect(pub.status).toBe(200);
    const titles = (await pub.json()).tickets.map((t: { title: string }) => t.title);
    expect(titles).toContain("Public ticket text");
    expect(titles).not.toContain("Private ticket text");

    const priv = await app.request("/api/projects/PRIV/tickets", viewerInit("nonMember"));
    expect(priv.status).toBe(404);
  });

  it("member sees every ticket on owned projects", async () => {
    const pub = await app.request("/api/projects/PUB/tickets", viewerInit("member"));
    const titles = (await pub.json()).tickets.map((t: { title: string }) => t.title);
    expect(titles).toEqual(expect.arrayContaining(["Public ticket text", "Private ticket text"]));
  });

  it("service user sees every ticket on every project", async () => {
    const pub = await app.request("/api/projects/PUB/tickets", viewerInit("service"));
    const pubTitles = (await pub.json()).tickets.map((t: { title: string }) => t.title);
    expect(pubTitles).toEqual(expect.arrayContaining(["Public ticket text", "Private ticket text"]));

    const priv = await app.request("/api/projects/PRIV/tickets", viewerInit("service"));
    expect(priv.status).toBe(200);
  });
});

describe("access matrix: ticket detail GET /api/projects/:key/tickets/:num", () => {
  it("anon opens public ticket, 404s on private ticket and private project", async () => {
    const pub = await app.request(`/api/projects/PUB/tickets/${fixture.pubPublicTicket.number}`, viewerInit("anon"));
    expect(pub.status).toBe(200);

    const privTicketOnPubProject = await app.request(`/api/projects/PUB/tickets/${fixture.pubPrivateTicket.number}`, viewerInit("anon"));
    expect(privTicketOnPubProject.status).toBe(404);

    const ticketOnPrivProject = await app.request(`/api/projects/PRIV/tickets/${fixture.privTicket.number}`, viewerInit("anon"));
    expect(ticketOnPrivProject.status).toBe(404);
  });

  it("non-member opens public ticket only", async () => {
    const pub = await app.request(`/api/projects/PUB/tickets/${fixture.pubPublicTicket.number}`, viewerInit("nonMember"));
    expect(pub.status).toBe(200);
    const priv = await app.request(`/api/projects/PUB/tickets/${fixture.pubPrivateTicket.number}`, viewerInit("nonMember"));
    expect(priv.status).toBe(404);
  });

  it("member opens every ticket on owned project", async () => {
    const pub = await app.request(`/api/projects/PUB/tickets/${fixture.pubPublicTicket.number}`, viewerInit("member"));
    expect(pub.status).toBe(200);
    const priv = await app.request(`/api/projects/PUB/tickets/${fixture.pubPrivateTicket.number}`, viewerInit("member"));
    expect(priv.status).toBe(200);
  });

  it("service user opens every ticket on every project", async () => {
    const priv = await app.request(`/api/projects/PUB/tickets/${fixture.pubPrivateTicket.number}`, viewerInit("service"));
    expect(priv.status).toBe(200);
    const onPriv = await app.request(`/api/projects/PRIV/tickets/${fixture.privTicket.number}`, viewerInit("service"));
    expect(onPriv.status).toBe(200);
  });
});

describe("access matrix: comments GET /api/projects/:key/tickets/:num/comments", () => {
  it("anon reads comments on public ticket, 404 on private ticket", async () => {
    const ok = await app.request(`/api/projects/PUB/tickets/${fixture.pubPublicTicket.number}/comments`, viewerInit("anon"));
    expect(ok.status).toBe(200);
    expect((await ok.json()).comments).toHaveLength(1);

    const denied = await app.request(`/api/projects/PUB/tickets/${fixture.pubPrivateTicket.number}/comments`, viewerInit("anon"));
    expect(denied.status).toBe(404);
  });

  it("non-member reads comments on public ticket, 404 on private ticket", async () => {
    const ok = await app.request(`/api/projects/PUB/tickets/${fixture.pubPublicTicket.number}/comments`, viewerInit("nonMember"));
    expect(ok.status).toBe(200);
    const denied = await app.request(`/api/projects/PUB/tickets/${fixture.pubPrivateTicket.number}/comments`, viewerInit("nonMember"));
    expect(denied.status).toBe(404);
  });

  it("member reads comments on every owned ticket", async () => {
    const priv = await app.request(`/api/projects/PUB/tickets/${fixture.pubPrivateTicket.number}/comments`, viewerInit("member"));
    expect(priv.status).toBe(200);
    expect((await priv.json()).comments).toHaveLength(1);
  });

  it("service user reads comments on every ticket", async () => {
    const priv = await app.request(`/api/projects/PUB/tickets/${fixture.pubPrivateTicket.number}/comments`, viewerInit("service"));
    expect(priv.status).toBe(200);
    const onPriv = await app.request(`/api/projects/PRIV/tickets/${fixture.privTicket.number}/comments`, viewerInit("service"));
    expect(onPriv.status).toBe(200);
  });
});

describe("access matrix: activity GET /api/projects/:key/activity", () => {
  it("anon sees activity for public tickets only", async () => {
    const res = await app.request("/api/projects/PUB/activity", viewerInit("anon"));
    expect(res.status).toBe(200);
    const ticketIDs = new Set((await res.json()).activity.map((row: { ticketID: string }) => row.ticketID));
    expect(ticketIDs.has(fixture.pubPublicTicket.id)).toBe(true);
    expect(ticketIDs.has(fixture.pubPrivateTicket.id)).toBe(false);
  });

  it("non-member sees activity for public tickets only", async () => {
    const res = await app.request("/api/projects/PUB/activity", viewerInit("nonMember"));
    const ticketIDs = new Set((await res.json()).activity.map((row: { ticketID: string }) => row.ticketID));
    expect(ticketIDs.has(fixture.pubPublicTicket.id)).toBe(true);
    expect(ticketIDs.has(fixture.pubPrivateTicket.id)).toBe(false);
  });

  it("member sees activity for every owned ticket", async () => {
    const res = await app.request("/api/projects/PUB/activity", viewerInit("member"));
    const ticketIDs = new Set((await res.json()).activity.map((row: { ticketID: string }) => row.ticketID));
    expect(ticketIDs.has(fixture.pubPrivateTicket.id)).toBe(true);
  });

  it("service user sees activity for every ticket on every project", async () => {
    const onPub = await app.request("/api/projects/PUB/activity", viewerInit("service"));
    const pubIDs = new Set((await onPub.json()).activity.map((row: { ticketID: string }) => row.ticketID));
    expect(pubIDs.has(fixture.pubPrivateTicket.id)).toBe(true);
    const onPriv = await app.request("/api/projects/PRIV/activity", viewerInit("service"));
    expect(onPriv.status).toBe(200);
  });
});

describe("access matrix: search GET /api/search", () => {
  it("anon search excludes private tickets and private projects", async () => {
    const res = await app.request("/api/search?q=ticket", viewerInit("anon"));
    expect(res.status).toBe(200);
    const titles = (await res.json()).tickets.map((t: { title: string }) => t.title);
    expect(titles).toContain("Public ticket text");
    expect(titles).not.toContain("Private ticket text");
    expect(titles).not.toContain("Private project ticket");
  });

  it("non-member search excludes private tickets and private projects", async () => {
    const res = await app.request("/api/search?q=ticket", viewerInit("nonMember"));
    const titles = (await res.json()).tickets.map((t: { title: string }) => t.title);
    expect(titles).toContain("Public ticket text");
    expect(titles).not.toContain("Private ticket text");
    expect(titles).not.toContain("Private project ticket");
  });

  it("member search includes private tickets on owned projects", async () => {
    const res = await app.request("/api/search?q=ticket", viewerInit("member"));
    const titles = (await res.json()).tickets.map((t: { title: string }) => t.title);
    expect(titles).toEqual(expect.arrayContaining(["Public ticket text", "Private ticket text", "Private project ticket"]));
  });

  it("service user search returns every ticket on every project", async () => {
    const res = await app.request("/api/search?q=ticket", viewerInit("service"));
    const titles = (await res.json()).tickets.map((t: { title: string }) => t.title);
    expect(titles).toEqual(expect.arrayContaining(["Public ticket text", "Private ticket text", "Private project ticket"]));
  });
});
