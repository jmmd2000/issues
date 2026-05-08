import { describe, it, expect, beforeEach } from "vitest";
import app from "../index";
import { db } from "../db";
import { comments, labels, statuses, ticketActivity, users } from "../db/schema";
import { and, eq } from "drizzle-orm";
import { ActivityService } from "../services/activityService";
import { TicketService } from "../services/ticketService";
import type { TicketSnapshot } from "../lib/types";
import { createAuthenticatedUser, createExtraUser, createProject, resetDatabase } from "./helpers";

let cookies: string;
let userID: string;
let projectID: string;
let statusID: string;
let altStatusID: string;

async function seedStatusID(slug = "backlog"): Promise<string> {
  const [row] = await db
    .select({ id: statuses.id })
    .from(statuses)
    .where(and(eq(statuses.projectID, projectID), eq(statuses.slug, slug)))
    .limit(1);
  return row.id;
}

async function createTicket(overrides: Partial<{ title: string; description: string; statusID: string; priority: string; labelIDs: string[] }> = {}) {
  const res = await app.request("/api/projects/TEST/tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookies },
    body: JSON.stringify({ title: "Ticket", statusID, ...overrides }),
  });
  const body = await res.json();
  return body.ticket;
}

async function setupFixture() {
  await resetDatabase();
  ({ cookies } = await createAuthenticatedUser());
  const project = await createProject(cookies);
  projectID = project.id;
  const [me] = await db.select({ id: users.id }).from(users).limit(1);
  userID = me.id;
  statusID = await seedStatusID("backlog");
  altStatusID = await seedStatusID("done");
}

describe("logCreate", () => {
  beforeEach(setupFixture);

  it("writes a single created row", async () => {
    const ticket = await createTicket({ title: "Audit" });

    const rows = await db.select().from(ticketActivity).where(eq(ticketActivity.ticketID, ticket.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("created");
    expect(rows[0].userID).toBe(userID);
    expect(rows[0].fieldName).toBeNull();
    expect(rows[0].oldValue).toBeNull();
    expect(rows[0].newValue).toEqual({ value: "Audit" });
  });
});

describe("logUpdate", () => {
  beforeEach(setupFixture);

  it("writes nothing when before and after are equal", async () => {
    const ticket = await createTicket({ title: "Stable" });
    const snapshot = await TicketService.loadSnapshot(db, { ticketID: ticket.id });

    await db.transaction(async (tx) => {
      await ActivityService.logUpdate(tx, userID, snapshot, snapshot);
    });

    const rows = await db
      .select()
      .from(ticketActivity)
      .where(and(eq(ticketActivity.ticketID, ticket.id), eq(ticketActivity.action, "updated")));
    expect(rows).toHaveLength(0);
  });

  it("writes a row for each changed scalar field", async () => {
    const ticket = await createTicket({ title: "Before", priority: "medium" });
    const before = await TicketService.loadSnapshot(db, { ticketID: ticket.id });
    const after: TicketSnapshot = { ...before, title: "After", description: "New body", priority: "high" };

    await db.transaction(async (tx) => {
      await ActivityService.logUpdate(tx, userID, before, after);
    });

    const rows = await db
      .select()
      .from(ticketActivity)
      .where(and(eq(ticketActivity.ticketID, ticket.id), eq(ticketActivity.action, "updated")));
    const byField = new Map(rows.map((r) => [r.fieldName, r]));

    expect(byField.get("title")?.oldValue).toEqual({ value: "Before" });
    expect(byField.get("title")?.newValue).toEqual({ value: "After" });
    expect(byField.get("description")?.newValue).toEqual({ value: "New body" });
    expect(byField.get("priority")?.newValue).toEqual({ value: "high" });
  });

  it("writes ref-field changes with {id, name} snapshots", async () => {
    const ticket = await createTicket({ title: "Ref test" });
    const before = await TicketService.loadSnapshot(db, { ticketID: ticket.id });
    const { cookies: otherCookies, user: other } = await createExtraUser("Other", "other@test.com");
    void otherCookies;
    const after: TicketSnapshot = {
      ...before,
      status: { id: altStatusID, name: "Done" },
      assignee: { id: other.id, name: other.name },
    };

    await db.transaction(async (tx) => {
      await ActivityService.logUpdate(tx, userID, before, after);
    });

    const rows = await db
      .select()
      .from(ticketActivity)
      .where(and(eq(ticketActivity.ticketID, ticket.id), eq(ticketActivity.action, "updated")));
    const byField = new Map(rows.map((r) => [r.fieldName, r]));

    expect((byField.get("statusID")?.oldValue as { id: string }).id).toBe(before.status.id);
    expect((byField.get("statusID")?.newValue as { id: string }).id).toBe(altStatusID);
    expect(byField.get("assigneeID")?.oldValue).toBeNull();
    expect((byField.get("assigneeID")?.newValue as { id: string }).id).toBe(other.id);
  });

  it("emits label_added and label_removed rows via set-diff", async () => {
    const allLabels = await db.select({ id: labels.id, name: labels.name }).from(labels).where(eq(labels.projectID, projectID));
    const [keep, remove, add] = allLabels;

    const ticket = await createTicket({ title: "Labels", labelIDs: [keep.id, remove.id] });
    const before = await TicketService.loadSnapshot(db, { ticketID: ticket.id });
    const after: TicketSnapshot = {
      ...before,
      labels: [
        { id: keep.id, name: keep.name },
        { id: add.id, name: add.name },
      ],
    };

    await db.transaction(async (tx) => {
      await ActivityService.logUpdate(tx, userID, before, after);
    });

    const added = await db
      .select()
      .from(ticketActivity)
      .where(and(eq(ticketActivity.ticketID, ticket.id), eq(ticketActivity.action, "label_added")));
    const removed = await db
      .select()
      .from(ticketActivity)
      .where(and(eq(ticketActivity.ticketID, ticket.id), eq(ticketActivity.action, "label_removed")));

    expect(added).toHaveLength(1);
    expect(added[0].newValue).toEqual({ id: add.id, name: add.name });
    expect(removed).toHaveLength(1);
    expect(removed[0].oldValue).toEqual({ id: remove.id, name: remove.name });
  });

  it("rolls back all activity rows when the transaction throws", async () => {
    const ticket = await createTicket({ title: "Rollback" });
    const before = await TicketService.loadSnapshot(db, { ticketID: ticket.id });
    const after: TicketSnapshot = { ...before, title: "Would be lost" };

    await expect(
      db.transaction(async (tx) => {
        await ActivityService.logUpdate(tx, userID, before, after);
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    const rows = await db
      .select()
      .from(ticketActivity)
      .where(and(eq(ticketActivity.ticketID, ticket.id), eq(ticketActivity.action, "updated")));
    expect(rows).toHaveLength(0);
  });
});

describe("logDelete / logRestore", () => {
  beforeEach(setupFixture);

  it("writes a deleted row on soft delete and a restored row on restore", async () => {
    const ticket = await createTicket({ title: "Cycle" });

    await TicketService.softDeleteTicket(ticket.id, projectID, userID);
    await TicketService.restoreTicket(ticket.id, projectID, userID);

    const deleted = await db
      .select()
      .from(ticketActivity)
      .where(and(eq(ticketActivity.ticketID, ticket.id), eq(ticketActivity.action, "deleted")));
    const restored = await db
      .select()
      .from(ticketActivity)
      .where(and(eq(ticketActivity.ticketID, ticket.id), eq(ticketActivity.action, "restored")));

    expect(deleted).toHaveLength(1);
    expect(deleted[0].newValue).toEqual({ value: "Cycle" });
    expect(restored).toHaveLength(1);
    expect(restored[0].newValue).toEqual({ value: "Cycle" });
  });
});

describe("logComment", () => {
  beforeEach(setupFixture);

  it("writes a comment_added row with id + excerpt newValue", async () => {
    const ticket = await createTicket({ title: "Comment add" });
    const [comment] = await db.insert(comments).values({ ticketID: ticket.id, authorID: userID, body: "Hello" }).returning();

    await db.transaction(async (tx) => {
      await ActivityService.logComment(tx, {
        userID,
        ticketID: ticket.id,
        kind: "added",
        comment: { id: comment.id, body: comment.body },
      });
    });

    const rows = await db
      .select()
      .from(ticketActivity)
      .where(and(eq(ticketActivity.ticketID, ticket.id), eq(ticketActivity.action, "comment_added")));
    expect(rows).toHaveLength(1);
    expect(rows[0].fieldName).toBeNull();
    expect(rows[0].oldValue).toBeNull();
    expect(rows[0].newValue).toEqual({ id: comment.id, excerpt: "Hello" });
  });

  it("writes a comment_edited row carrying full old/new bodies", async () => {
    const ticket = await createTicket({ title: "Comment edit" });
    const [comment] = await db.insert(comments).values({ ticketID: ticket.id, authorID: userID, body: "Updated body" }).returning();

    await db.transaction(async (tx) => {
      await ActivityService.logComment(tx, {
        userID,
        ticketID: ticket.id,
        kind: "edited",
        comment: { id: comment.id, body: comment.body },
        prevBody: "Original body",
      });
    });

    const rows = await db
      .select()
      .from(ticketActivity)
      .where(and(eq(ticketActivity.ticketID, ticket.id), eq(ticketActivity.action, "comment_edited")));
    expect(rows).toHaveLength(1);
    expect(rows[0].oldValue).toEqual({ body: "Original body" });
    expect(rows[0].newValue).toEqual({ body: "Updated body" });
  });

  it("writes a comment_deleted row with id + excerpt oldValue", async () => {
    const ticket = await createTicket({ title: "Comment delete" });
    const [comment] = await db.insert(comments).values({ ticketID: ticket.id, authorID: userID, body: "Goodbye" }).returning();

    await db.transaction(async (tx) => {
      await ActivityService.logComment(tx, {
        userID,
        ticketID: ticket.id,
        kind: "deleted",
        comment: { id: comment.id, body: comment.body },
      });
    });

    const rows = await db
      .select()
      .from(ticketActivity)
      .where(and(eq(ticketActivity.ticketID, ticket.id), eq(ticketActivity.action, "comment_deleted")));
    expect(rows).toHaveLength(1);
    expect(rows[0].oldValue).toEqual({ id: comment.id, excerpt: "Goodbye" });
    expect(rows[0].newValue).toBeNull();
  });

  it("collapses whitespace and truncates long bodies in excerpts", async () => {
    const ticket = await createTicket({ title: "Comment excerpt" });
    const longBody = "word ".repeat(100).trim();
    const [comment] = await db.insert(comments).values({ ticketID: ticket.id, authorID: userID, body: longBody }).returning();

    await db.transaction(async (tx) => {
      await ActivityService.logComment(tx, {
        userID,
        ticketID: ticket.id,
        kind: "added",
        comment: { id: comment.id, body: comment.body },
      });
    });

    const [row] = await db
      .select()
      .from(ticketActivity)
      .where(and(eq(ticketActivity.ticketID, ticket.id), eq(ticketActivity.action, "comment_added")));
    const excerpt = (row.newValue as { excerpt: string }).excerpt;
    expect(excerpt.endsWith("...")).toBe(true);
    expect(excerpt.length).toBeLessThanOrEqual(203);
  });

  it("rolls back the activity row when the transaction throws", async () => {
    const ticket = await createTicket({ title: "Comment rollback" });
    const [comment] = await db.insert(comments).values({ ticketID: ticket.id, authorID: userID, body: "Lost" }).returning();

    await expect(
      db.transaction(async (tx) => {
        await ActivityService.logComment(tx, {
          userID,
          ticketID: ticket.id,
          kind: "added",
          comment: { id: comment.id, body: comment.body },
        });
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    const rows = await db
      .select()
      .from(ticketActivity)
      .where(and(eq(ticketActivity.ticketID, ticket.id), eq(ticketActivity.action, "comment_added")));
    expect(rows).toHaveLength(0);
  });
});

describe("listForTicket", () => {
  beforeEach(setupFixture);

  it("returns rows newest-first with the acting user joined", async () => {
    const ticket = await createTicket({ title: "Join me" });

    await app.request(`/api/projects/TEST/tickets/${ticket.number}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ title: "Join me updated" }),
    });

    const rows = await ActivityService.listForTicket(ticket.id);

    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0].createdAt >= rows[rows.length - 1].createdAt).toBe(true);
    expect(rows[0].user?.id).toBe(userID);
    expect(rows[0].user?.name).toBeDefined();
  });
});
