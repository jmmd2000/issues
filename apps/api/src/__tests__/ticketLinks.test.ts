import { describe, it, expect, beforeEach } from "vitest";
import app from "../index";
import { db } from "../db";
import { statuses, ticketActivity, ticketLinks } from "../db/schema";
import { and, eq } from "drizzle-orm";
import { createAuthenticatedUser, createExtraUser, createProject, resetDatabase } from "./helpers";

let cookies: string;
let projectID: string;
let statusID: string;

async function seedStatusID(): Promise<string> {
  const [row] = await db.select({ id: statuses.id }).from(statuses).where(eq(statuses.projectID, projectID)).limit(1);
  return row.id;
}

async function createTicket(authCookies = cookies, key = "TEST", title = "Ticket") {
  const res = await app.request(`/api/projects/${key}/tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: authCookies },
    body: JSON.stringify({ title, statusID }),
  });
  const body = await res.json();
  return body.ticket;
}

async function createLink(targetRef: string, linkType: string, num: number, authCookies = cookies, direction: "outgoing" | "incoming" = "outgoing") {
  return app.request(`/api/projects/TEST/tickets/${num}/links`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: authCookies },
    body: JSON.stringify({ targetRef, linkType, direction }),
  });
}

describe("Ticket links", () => {
  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
    const project = await createProject(cookies);
    projectID = project.id;
    statusID = await seedStatusID();
  });

  describe("POST /api/projects/:key/tickets/:num/links", () => {
    it("creates a link and logs source-side activity", async () => {
      const a = await createTicket(cookies, "TEST", "A");
      const b = await createTicket(cookies, "TEST", "B");

      const res = await createLink(`TEST-${b.number}`, "blocks", a.number);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.link).toMatchObject({ linkType: "blocks", direction: "outgoing" });
      expect(body.link.ticket).toMatchObject({ id: b.id, number: b.number, title: "B", projectKey: "TEST" });

      const sourceRows = await db
        .select()
        .from(ticketActivity)
        .where(and(eq(ticketActivity.ticketID, a.id), eq(ticketActivity.action, "link_added")));
      expect(sourceRows).toHaveLength(1);
      expect(sourceRows[0].fieldName).toBe("blocks");
      expect(sourceRows[0].newValue).toEqual({ ticketID: b.id, number: b.number, title: "B", projectKey: "TEST", direction: "outgoing" });

      // The target ticket also gets a row, marked incoming, so its activity tab reflects the relationship.
      const targetRows = await db
        .select()
        .from(ticketActivity)
        .where(and(eq(ticketActivity.ticketID, b.id), eq(ticketActivity.action, "link_added")));
      expect(targetRows).toHaveLength(1);
      expect(targetRows[0].fieldName).toBe("blocks");
      expect(targetRows[0].newValue).toEqual({ ticketID: a.id, number: a.number, title: "A", projectKey: "TEST", direction: "incoming" });
    });

    it("rejects self-links with 400", async () => {
      const a = await createTicket(cookies, "TEST", "A");
      const res = await createLink(`TEST-${a.number}`, "blocks", a.number);
      expect(res.status).toBe(400);
    });

    it("rejects duplicate links with 409", async () => {
      const a = await createTicket(cookies, "TEST", "A");
      const b = await createTicket(cookies, "TEST", "B");
      await createLink(`TEST-${b.number}`, "blocks", a.number);
      const res = await createLink(`TEST-${b.number}`, "blocks", a.number);
      expect(res.status).toBe(409);
    });

    it("allows the same pair with different link types", async () => {
      const a = await createTicket(cookies, "TEST", "A");
      const b = await createTicket(cookies, "TEST", "B");
      const r1 = await createLink(`TEST-${b.number}`, "blocks", a.number);
      const r2 = await createLink(`TEST-${b.number}`, "relates_to", a.number);
      expect(r1.status).toBe(201);
      expect(r2.status).toBe(201);
    });

    it("rejects malformed refs with 400", async () => {
      const a = await createTicket(cookies, "TEST", "A");
      const res = await createLink("not-a-ref", "blocks", a.number);
      expect(res.status).toBe(400);
    });

    it("returns 404 when target ticket does not exist", async () => {
      const a = await createTicket(cookies, "TEST", "A");
      const res = await createLink("TEST-999", "blocks", a.number);
      expect(res.status).toBe(404);
    });

    it("rejects non-members with 404", async () => {
      const a = await createTicket(cookies, "TEST", "A");
      const b = await createTicket(cookies, "TEST", "B");
      const { cookies: outsider } = await createExtraUser("Outsider", "outsider@test.com");
      const res = await createLink(`TEST-${b.number}`, "blocks", a.number, outsider);
      expect(res.status).toBe(404);
    });

    it("creates an incoming link by swapping source and target", async () => {
      const a = await createTicket(cookies, "TEST", "A");
      const b = await createTicket(cookies, "TEST", "B");

      const res = await createLink(`TEST-${b.number}`, "blocks", a.number, cookies, "incoming");
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.link).toMatchObject({ direction: "incoming", linkType: "blocks" });
      expect(body.link.ticket).toMatchObject({ id: b.id, number: b.number });

      // From A's GET, the same row should appear as incoming.
      const aLinks = await (await app.request(`/api/projects/TEST/tickets/${a.number}/links`, { method: "GET", headers: { Cookie: cookies } })).json();
      expect(aLinks.links).toHaveLength(1);
      expect(aLinks.links[0]).toMatchObject({ direction: "incoming" });

      // From B's GET, it appears as outgoing (B is the canonical source).
      const bLinks = await (await app.request(`/api/projects/TEST/tickets/${b.number}/links`, { method: "GET", headers: { Cookie: cookies } })).json();
      expect(bLinks.links).toHaveLength(1);
      expect(bLinks.links[0]).toMatchObject({ direction: "outgoing" });

      // Both sides get activity rows: B (canonical source) outgoing, A (target) incoming.
      const bActivity = await db
        .select()
        .from(ticketActivity)
        .where(and(eq(ticketActivity.ticketID, b.id), eq(ticketActivity.action, "link_added")));
      expect(bActivity).toHaveLength(1);
      expect(bActivity[0].newValue).toEqual({ ticketID: a.id, number: a.number, title: "A", projectKey: "TEST", direction: "outgoing" });
      const aActivity = await db
        .select()
        .from(ticketActivity)
        .where(and(eq(ticketActivity.ticketID, a.id), eq(ticketActivity.action, "link_added")));
      expect(aActivity).toHaveLength(1);
      expect(aActivity[0].newValue).toEqual({ ticketID: b.id, number: b.number, title: "B", projectKey: "TEST", direction: "incoming" });
    });

    it("rejects an incoming self-link", async () => {
      const a = await createTicket(cookies, "TEST", "A");
      const res = await createLink(`TEST-${a.number}`, "blocks", a.number, cookies, "incoming");
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/projects/:key/tickets/:num/links", () => {
    it("returns outgoing links from the source side", async () => {
      const a = await createTicket(cookies, "TEST", "A");
      const b = await createTicket(cookies, "TEST", "B");
      await createLink(`TEST-${b.number}`, "blocks", a.number);

      const res = await app.request(`/api/projects/TEST/tickets/${a.number}/links`, { method: "GET", headers: { Cookie: cookies } });
      const body = await res.json();
      expect(body.links).toHaveLength(1);
      expect(body.links[0]).toMatchObject({ direction: "outgoing", linkType: "blocks" });
      expect(body.links[0].ticket).toMatchObject({ number: b.number });
    });

    it("returns incoming links from the target side with direction inverted", async () => {
      const a = await createTicket(cookies, "TEST", "A");
      const b = await createTicket(cookies, "TEST", "B");
      await createLink(`TEST-${b.number}`, "blocks", a.number);

      const res = await app.request(`/api/projects/TEST/tickets/${b.number}/links`, { method: "GET", headers: { Cookie: cookies } });
      const body = await res.json();
      expect(body.links).toHaveLength(1);
      expect(body.links[0]).toMatchObject({ direction: "incoming", linkType: "blocks" });
      expect(body.links[0].ticket).toMatchObject({ number: a.number });
    });

    it("excludes links to soft-deleted tickets", async () => {
      const a = await createTicket(cookies, "TEST", "A");
      const b = await createTicket(cookies, "TEST", "B");
      await createLink(`TEST-${b.number}`, "blocks", a.number);

      await app.request(`/api/projects/TEST/tickets/${b.number}`, { method: "DELETE", headers: { Cookie: cookies } });

      const res = await app.request(`/api/projects/TEST/tickets/${a.number}/links`, { method: "GET", headers: { Cookie: cookies } });
      const body = await res.json();
      expect(body.links).toHaveLength(0);
    });
  });

  describe("DELETE /api/projects/:key/tickets/:num/links/:id", () => {
    it("deletes from the source side and logs link_removed on both sides", async () => {
      const a = await createTicket(cookies, "TEST", "A");
      const b = await createTicket(cookies, "TEST", "B");
      const created = await (await createLink(`TEST-${b.number}`, "blocks", a.number)).json();

      const res = await app.request(`/api/projects/TEST/tickets/${a.number}/links/${created.link.id}`, { method: "DELETE", headers: { Cookie: cookies } });
      expect(res.status).toBe(204);

      const remaining = await db.select().from(ticketLinks).where(eq(ticketLinks.id, created.link.id));
      expect(remaining).toHaveLength(0);

      const aRemove = await db
        .select()
        .from(ticketActivity)
        .where(and(eq(ticketActivity.ticketID, a.id), eq(ticketActivity.action, "link_removed")));
      expect(aRemove).toHaveLength(1);
      expect(aRemove[0].fieldName).toBe("blocks");
      const bRemove = await db
        .select()
        .from(ticketActivity)
        .where(and(eq(ticketActivity.ticketID, b.id), eq(ticketActivity.action, "link_removed")));
      expect(bRemove).toHaveLength(1);
    });

    it("deletes from the target side", async () => {
      const a = await createTicket(cookies, "TEST", "A");
      const b = await createTicket(cookies, "TEST", "B");
      const created = await (await createLink(`TEST-${b.number}`, "blocks", a.number)).json();

      const res = await app.request(`/api/projects/TEST/tickets/${b.number}/links/${created.link.id}`, { method: "DELETE", headers: { Cookie: cookies } });
      expect(res.status).toBe(204);
    });

    it("returns 404 when the link exists but is not connected to the requesting ticket", async () => {
      const a = await createTicket(cookies, "TEST", "A");
      const b = await createTicket(cookies, "TEST", "B");
      const c = await createTicket(cookies, "TEST", "C");
      const created = await (await createLink(`TEST-${b.number}`, "blocks", a.number)).json();

      const res = await app.request(`/api/projects/TEST/tickets/${c.number}/links/${created.link.id}`, { method: "DELETE", headers: { Cookie: cookies } });
      expect(res.status).toBe(404);
    });
  });
});
