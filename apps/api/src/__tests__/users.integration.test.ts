import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import sharp from "sharp";

// Set UPLOADS_DIR before importing anything that resolves it.
const TEST_UPLOADS_DIR = path.join(os.tmpdir(), `issues-test-uploads-users-${process.pid}`);
process.env.UPLOADS_DIR = TEST_UPLOADS_DIR;

import app from "../index";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { createAuthenticatedUser, resetDatabase } from "./helpers";
import { listStoredKeys, resetUploadsDir } from "../lib/storage";

let cookies: string;

async function makeImage(width = 64, height = 64, channels: 3 | 4 = 3): Promise<Buffer> {
  return sharp({
    create: { width, height, channels, background: { r: 0, g: 128, b: 255, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

async function uniqueImage(seed: number): Promise<Buffer> {
  return sharp({
    create: { width: 64, height: 64, channels: 3, background: { r: seed % 256, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
}

// Newer @types/node widens Buffer's underlying buffer to ArrayBufferLike,
// which BlobPart's strict typing refuses. Copying into a fresh ArrayBuffer
// gets us back to a regular `ArrayBuffer` view.
function bytesToFile(bytes: Buffer, name: string, type: string): File {
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return new File([ab], name, { type });
}

async function postAvatar(file: File, authCookies = cookies) {
  const fd = new FormData();
  fd.append("file", file);
  return app.request("/api/users/me/avatar", {
    method: "POST",
    headers: { Cookie: authCookies },
    body: fd,
  });
}

beforeAll(() => {
  // Re-pin to this suite's dir; another test file may have overwritten the env at its own module load.
  process.env.UPLOADS_DIR = TEST_UPLOADS_DIR;
  fs.mkdirSync(TEST_UPLOADS_DIR, { recursive: true });
  resetUploadsDir();
});

afterAll(() => {
  fs.rmSync(TEST_UPLOADS_DIR, { recursive: true, force: true });
});

beforeEach(async () => {
  for (const entry of fs.readdirSync(TEST_UPLOADS_DIR)) {
    fs.rmSync(path.join(TEST_UPLOADS_DIR, entry), { force: true });
  }
  resetUploadsDir();
  await resetDatabase();
  ({ cookies } = await createAuthenticatedUser());
});

describe("POST /api/users/me/avatar", () => {
  it("stores the avatar, sets users.avatar_url, and writes the file to disk", async () => {
    const file = bytesToFile(await makeImage(), "me.png", "image/png");
    const res = await postAvatar(file);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.user.avatarURL).toMatch(/^\/uploads\/[a-f0-9]{64}\.webp$/);

    const [row] = await db.select({ avatarURL: users.avatarURL }).from(users).where(eq(users.email, "test@test.com"));
    expect(row.avatarURL).toBe(body.user.avatarURL);

    const stored = await listStoredKeys();
    expect(stored).toHaveLength(1);
  });

  it("returns 401 without a session cookie", async () => {
    const file = bytesToFile(await makeImage(), "me.png", "image/png");
    const fd = new FormData();
    fd.append("file", file);
    const res = await app.request("/api/users/me/avatar", { method: "POST", body: fd });
    expect(res.status).toBe(401);
  });

  it("returns 400 when the `file` field is missing", async () => {
    const fd = new FormData();
    const res = await app.request("/api/users/me/avatar", { method: "POST", headers: { Cookie: cookies }, body: fd });
    expect(res.status).toBe(400);
  });

  it("returns 415 when the upload is not an image", async () => {
    const file = bytesToFile(Buffer.from("hello"), "me.txt", "text/plain");
    const res = await postAvatar(file);
    expect(res.status).toBe(415);
  });

  it("replaces the previous avatar and removes the orphaned file from disk", async () => {
    const firstRes = await postAvatar(bytesToFile(await uniqueImage(1), "first.png", "image/png"));
    const firstURL = (await firstRes.json()).user.avatarURL as string;
    const firstKey = firstURL.replace("/uploads/", "");

    const secondRes = await postAvatar(bytesToFile(await uniqueImage(2), "second.png", "image/png"));
    expect(secondRes.status).toBe(200);
    const secondURL = (await secondRes.json()).user.avatarURL as string;
    expect(secondURL).not.toBe(firstURL);

    const stored = await listStoredKeys();
    expect(stored).toHaveLength(1);
    expect(stored).not.toContain(firstKey);
  });

  it("keeps the avatar URL stable when the same image is re-uploaded", async () => {
    const file = bytesToFile(await uniqueImage(5), "same.png", "image/png");
    const first = (await (await postAvatar(file)).json()).user.avatarURL;
    const second = (await (await postAvatar(bytesToFile(await uniqueImage(5), "same.png", "image/png"))).json()).user.avatarURL;
    expect(second).toBe(first);

    const stored = await listStoredKeys();
    expect(stored).toHaveLength(1);
  });
});

describe("DELETE /api/users/me/avatar", () => {
  it("clears users.avatar_url and removes the file from disk", async () => {
    await postAvatar(bytesToFile(await uniqueImage(3), "me.png", "image/png"));
    expect(await listStoredKeys()).toHaveLength(1);

    const res = await app.request("/api/users/me/avatar", { method: "DELETE", headers: { Cookie: cookies } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.user.avatarURL).toBeNull();

    const [row] = await db.select({ avatarURL: users.avatarURL }).from(users).where(eq(users.email, "test@test.com"));
    expect(row.avatarURL).toBeNull();

    expect(await listStoredKeys()).toHaveLength(0);
  });

  it("is a no-op when there is no avatar set", async () => {
    const res = await app.request("/api/users/me/avatar", { method: "DELETE", headers: { Cookie: cookies } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.avatarURL).toBeNull();
  });

  it("returns 401 without a session cookie", async () => {
    const res = await app.request("/api/users/me/avatar", { method: "DELETE" });
    expect(res.status).toBe(401);
  });
});

describe("GET /uploads/:storageKey for avatars", () => {
  it("serves the avatar publicly with no session cookie", async () => {
    const postRes = await postAvatar(bytesToFile(await uniqueImage(7), "me.png", "image/png"));
    const url = (await postRes.json()).user.avatarURL as string;

    const res = await app.request(url, { method: "GET" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    expect(res.headers.get("Cache-Control")).toContain("public");
  });

  it("404s after the avatar has been cleared", async () => {
    const postRes = await postAvatar(bytesToFile(await uniqueImage(8), "me.png", "image/png"));
    const url = (await postRes.json()).user.avatarURL as string;
    await app.request("/api/users/me/avatar", { method: "DELETE", headers: { Cookie: cookies } });

    const res = await app.request(url, { method: "GET" });
    expect(res.status).toBe(404);
  });
});
