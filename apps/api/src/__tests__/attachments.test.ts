import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import sharp from "sharp";

// Set UPLOADS_DIR before importing anything that resolves it.
const TEST_UPLOADS_DIR = path.join(os.tmpdir(), `issues-test-uploads-${process.pid}`);
process.env.UPLOADS_DIR = TEST_UPLOADS_DIR;

import app from "../index";
import { db } from "../db";
import { attachments, projectMembers, statuses, ticketActivity } from "../db/schema";
import { and, eq } from "drizzle-orm";
import { createAuthenticatedUser, createExtraUser, createProject, resetDatabase } from "./helpers";
import { listStoredKeys, resetUploadsDir } from "../lib/storage";

let cookies: string;
let projectID: string;
let statusID: string;

async function seedStatusID(): Promise<string> {
  const [row] = await db.select({ id: statuses.id }).from(statuses).where(eq(statuses.projectID, projectID)).limit(1);
  return row.id;
}

async function makeImage(width = 4, height = 4, channels: 3 | 4 = 3): Promise<Buffer> {
  return sharp({
    create: { width, height, channels, background: { r: 255, g: 0, b: 0, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

async function uniqueImage(seed: number): Promise<Buffer> {
  return sharp({
    create: { width: 4 + (seed % 4), height: 4 + (seed % 4), channels: 3, background: { r: seed % 256, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
}

async function createTicket(authCookies = cookies, key = "TEST", overrides: Partial<{ title: string; visibility: "public" | "private" }> = {}) {
  const { visibility, ...createBody } = overrides;
  const res = await app.request(`/api/projects/${key}/tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: authCookies },
    body: JSON.stringify({ title: "Ticket", statusID, ...createBody }),
  });
  const body = await res.json();
  if (visibility) {
    await app.request(`/api/projects/${key}/tickets/${body.ticket.number}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: authCookies },
      body: JSON.stringify({ visibility }),
    });
  }
  return body.ticket;
}

// Newer @types/node widens Buffer's underlying buffer to ArrayBufferLike,
// which BlobPart's strict typing refuses. Copying into a fresh ArrayBuffer
// gets us back to a regular `ArrayBuffer` view.
function bytesToFile(bytes: Buffer, name: string, type: string): File {
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return new File([ab], name, { type });
}

async function postAttachment(ticketNumber: number, file: File, authCookies = cookies) {
  const fd = new FormData();
  fd.append("file", file);
  return app.request(`/api/projects/TEST/tickets/${ticketNumber}/attachments`, {
    method: "POST",
    headers: { Cookie: authCookies },
    body: fd,
  });
}

beforeAll(() => {
  fs.mkdirSync(TEST_UPLOADS_DIR, { recursive: true });
  resetUploadsDir();
});

afterAll(() => {
  fs.rmSync(TEST_UPLOADS_DIR, { recursive: true, force: true });
});

describe("Attachments", () => {
  beforeEach(async () => {
    for (const f of fs.readdirSync(TEST_UPLOADS_DIR)) {
      fs.rmSync(path.join(TEST_UPLOADS_DIR, f), { force: true });
    }
    delete process.env.MAX_UPLOADS_BYTES;
    delete process.env.MAX_FILE_BYTES;
    delete process.env.MAX_IMAGE_BYTES;
    delete process.env.MAX_IMAGE_OUTPUT_BYTES;
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
    const project = await createProject(cookies);
    projectID = project.id;
    statusID = await seedStatusID();
  });

  describe("POST /api/projects/:key/tickets/:num/attachments", () => {
    it("uploads an image, writes a webp file, and logs activity", async () => {
      const ticket = await createTicket();
      const png = await makeImage();
      const res = await postAttachment(ticket.number, bytesToFile(png, "screen.png", "image/png"));
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.attachment).toMatchObject({ filename: "screen.png", isImage: true, mimeType: "image/webp" });
      expect(body.attachment.width).toBeGreaterThan(0);
      expect(body.attachment.height).toBeGreaterThan(0);
      expect(body.attachment.url).toBe(`/uploads/${body.attachment.storageKey}`);

      const onDisk = await listStoredKeys();
      expect(onDisk).toContain(body.attachment.storageKey);

      const activity = await db
        .select()
        .from(ticketActivity)
        .where(and(eq(ticketActivity.ticketID, ticket.id), eq(ticketActivity.action, "attachment_added")));
      expect(activity).toHaveLength(1);
      expect(activity[0].newValue).toEqual({ id: body.attachment.id, filename: "screen.png" });
    });

    it("uploads a non-image file as-is and marks it isImage=false", async () => {
      const ticket = await createTicket();
      const pdfBytes = Buffer.from("%PDF-1.4 sample contents");
      const res = await postAttachment(ticket.number, bytesToFile(pdfBytes, "doc.pdf", "application/pdf"));
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.attachment).toMatchObject({ filename: "doc.pdf", isImage: false, mimeType: "application/pdf", width: null, height: null });
      expect(body.attachment.storageKey.endsWith(".pdf")).toBe(true);
    });

    it("rejects unknown extensions with 415", async () => {
      const ticket = await createTicket();
      const bytes = Buffer.from("MZ");
      const res = await postAttachment(ticket.number, bytesToFile(bytes, "hack.exe", "application/octet-stream"));
      expect(res.status).toBe(415);
    });

    it("rejects raw files exceeding MAX_FILE_BYTES with 413", async () => {
      process.env.MAX_FILE_BYTES = "100";
      const ticket = await createTicket();
      const bytes = Buffer.alloc(200, 1);
      const res = await postAttachment(ticket.number, bytesToFile(bytes, "big.zip", "application/zip"));
      expect(res.status).toBe(413);
    });

    it("dedups identical image content into a single file", async () => {
      const ticket = await createTicket();
      const png = await makeImage();

      const first = await postAttachment(ticket.number, bytesToFile(png, "a.png", "image/png"));
      const second = await postAttachment(ticket.number, bytesToFile(png, "b.png", "image/png"));
      expect(first.status).toBe(201);
      expect(second.status).toBe(201);

      const firstBody = await first.json();
      const secondBody = await second.json();
      expect(firstBody.attachment.storageKey).toBe(secondBody.attachment.storageKey);

      const onDisk = await listStoredKeys();
      expect(onDisk).toHaveLength(1);

      const rows = await db.select().from(attachments).where(eq(attachments.ticketID, ticket.id));
      expect(rows).toHaveLength(2);
    });

    it("enforces the 10-per-ticket limit with 409", async () => {
      const ticket = await createTicket();
      for (let i = 0; i < 10; i++) {
        const png = await uniqueImage(i);
        const res = await postAttachment(ticket.number, bytesToFile(png, `file-${i}.png`, "image/png"));
        expect(res.status).toBe(201);
      }
      const png = await uniqueImage(99);
      const res = await postAttachment(ticket.number, bytesToFile(png, "extra.png", "image/png"));
      expect(res.status).toBe(409);
    });

    it("rejects when total storage would exceed MAX_UPLOADS_BYTES with 507", async () => {
      // Tiny cap, 10 bytes — even the smallest webp won't fit.
      process.env.MAX_UPLOADS_BYTES = "10";
      const ticket = await createTicket();
      const png = await uniqueImage(1);
      const res = await postAttachment(ticket.number, bytesToFile(png, "first.png", "image/png"));
      expect(res.status).toBe(507);
    });

    it("rejects unauthenticated requests with 401", async () => {
      const ticket = await createTicket();
      const png = await makeImage();
      const fd = new FormData();
      fd.append("file", bytesToFile(png, "x.png", "image/png"));
      const res = await app.request(`/api/projects/TEST/tickets/${ticket.number}/attachments`, { method: "POST", body: fd });
      expect(res.status).toBe(401);
    });

    it("rejects non-members with 404", async () => {
      const ticket = await createTicket();
      const { cookies: outsider } = await createExtraUser("Outsider", "outsider@test.com");
      const png = await makeImage();
      const res = await postAttachment(ticket.number, bytesToFile(png, "x.png", "image/png"), outsider);
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/projects/:key/tickets/:num/attachments", () => {
    it("lists attachments oldest-first with uploader joined", async () => {
      const ticket = await createTicket();
      await postAttachment(ticket.number, bytesToFile(await uniqueImage(1), "a.png", "image/png"));
      await postAttachment(ticket.number, bytesToFile(await uniqueImage(2), "b.png", "image/png"));

      const res = await app.request(`/api/projects/TEST/tickets/${ticket.number}/attachments`, { method: "GET", headers: { Cookie: cookies } });
      const body = await res.json();
      expect(body.attachments).toHaveLength(2);
      expect(body.attachments[0].uploader.name).toBe("Test User");
      expect(body.attachments[0].filename).toBe("a.png");
      expect(body.attachments[1].filename).toBe("b.png");
    });
  });

  describe("DELETE /api/projects/:key/attachments/:id", () => {
    it("hard-deletes the row, logs activity, leaves file on disk", async () => {
      const ticket = await createTicket();
      const png = await makeImage();
      const create = await postAttachment(ticket.number, bytesToFile(png, "a.png", "image/png"));
      const { attachment } = await create.json();

      const res = await app.request(`/api/projects/TEST/attachments/${attachment.id}`, { method: "DELETE", headers: { Cookie: cookies } });
      expect(res.status).toBe(204);

      const remaining = await db.select().from(attachments).where(eq(attachments.id, attachment.id));
      expect(remaining).toHaveLength(0);

      const onDisk = await listStoredKeys();
      expect(onDisk).toContain(attachment.storageKey);

      const activity = await db
        .select()
        .from(ticketActivity)
        .where(and(eq(ticketActivity.ticketID, ticket.id), eq(ticketActivity.action, "attachment_removed")));
      expect(activity).toHaveLength(1);
    });

    it("returns 404 when the attachment is in another project", async () => {
      const ticket = await createTicket();
      const create = await postAttachment(ticket.number, bytesToFile(await makeImage(), "a.png", "image/png"));
      const { attachment } = await create.json();

      await createProject(cookies, { key: "OTHER", name: "Other" });
      const res = await app.request(`/api/projects/OTHER/attachments/${attachment.id}`, { method: "DELETE", headers: { Cookie: cookies } });
      expect(res.status).toBe(404);
    });

    it("rejects deletes from non-uploader members with 403", async () => {
      const ticket = await createTicket();
      const create = await postAttachment(ticket.number, bytesToFile(await makeImage(), "a.png", "image/png"));
      const { attachment } = await create.json();

      const { user: outsider, cookies: outsiderCookies } = await createExtraUser("Outsider", "outsider@test.com");
      await db.insert(projectMembers).values({ projectID, userID: outsider.id, role: "member" });

      const res = await app.request(`/api/projects/TEST/attachments/${attachment.id}`, {
        method: "DELETE",
        headers: { Cookie: outsiderCookies },
      });
      expect(res.status).toBe(403);
    });
  });

  describe("GET /uploads/:storageKey", () => {
    it("returns 400 for malformed keys", async () => {
      const res = await app.request("/uploads/not-a-real-key", { method: "GET" });
      expect(res.status).toBe(400);
    });

    it("serves anonymously when ticket and project are both public", async () => {
      const ticket = await createTicket(cookies, "TEST", { visibility: "public" });
      const create = await postAttachment(ticket.number, bytesToFile(await makeImage(), "a.png", "image/png"));
      const { attachment } = await create.json();

      const res = await app.request(`/uploads/${attachment.storageKey}`, { method: "GET" });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/webp");
      expect(res.headers.get("cache-control")).toContain("public");
    });

    it("404s anonymously when the ticket is private (in a public project)", async () => {
      const ticket = await createTicket(cookies, "TEST", { visibility: "private" });
      const create = await postAttachment(ticket.number, bytesToFile(await uniqueImage(11), "p.png", "image/png"));
      const { attachment } = await create.json();

      const res = await app.request(`/uploads/${attachment.storageKey}`, { method: "GET" });
      expect(res.status).toBe(404);

      const memberRes = await app.request(`/uploads/${attachment.storageKey}`, { method: "GET", headers: { Cookie: cookies } });
      expect(memberRes.status).toBe(200);
      expect(memberRes.headers.get("cache-control")).toContain("private");
    });

    it("404s for a non-existent key", async () => {
      const fakeKey = `${"f".repeat(64)}.webp`;
      const res = await app.request(`/uploads/${fakeKey}`, { method: "GET" });
      expect(res.status).toBe(404);
    });
  });
});
