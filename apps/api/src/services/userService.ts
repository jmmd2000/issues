import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../db";
import { attachments, users } from "../db/schema";
import { processAvatar } from "../lib/images";
import { deleteAttachment, writeAttachment } from "../lib/storage";

const MAX_AVATAR_INPUT_BYTES = 10_000_000;

const userReturning = {
  id: users.id,
  name: users.name,
  email: users.email,
  avatarURL: users.avatarURL,
  createdAt: users.createdAt,
} as const;

export class UserService {
  /**
   * Processes and stores an uploaded avatar for the signed-in user, updates
   * the `users.avatar_url` column, and best-effort deletes the previous file
   * if nothing else still references it.
   * @param userID Authenticated user's ID
   * @param bytes Raw uploaded image bytes
   * @returns Updated user (id, name, email, avatarURL, createdAt)
   * @throws {HTTPException} 404 if the user is gone
   * @throws {HTTPException} 413 if the raw input exceeds the 10MB ceiling
   */
  static async setAvatar(userID: string, bytes: Buffer) {
    if (bytes.length > MAX_AVATAR_INPUT_BYTES) {
      throw new HTTPException(413, { message: `Avatar exceeds raw limit of ${formatBytes(MAX_AVATAR_INPUT_BYTES)}.` });
    }

    const processed = await processAvatar(bytes);
    const storageKey = `${processed.contentHash}${processed.extension}`;
    const newURL = `/uploads/${storageKey}`;

    const [previous] = await db.select({ avatarURL: users.avatarURL }).from(users).where(eq(users.id, userID)).limit(1);
    if (!previous) throw new HTTPException(404, { message: "User not found." });

    await writeAttachment(storageKey, processed.bytes);

    const [updated] = await db.update(users).set({ avatarURL: newURL }).where(eq(users.id, userID)).returning(userReturning);

    if (previous.avatarURL && previous.avatarURL !== newURL) {
      await sweepOrphanedStorage(previous.avatarURL);
    }

    return updated;
  }

  /**
   * Clears the signed-in user's avatar URL and removes the file from disk if
   * nothing else still references its storage key.
   * @param userID Authenticated user's ID
   * @returns Updated user (id, name, email, avatarURL, createdAt)
   * @throws {HTTPException} 404 if the user is gone
   */
  static async clearAvatar(userID: string) {
    const [previous] = await db.select({ avatarURL: users.avatarURL }).from(users).where(eq(users.id, userID)).limit(1);
    if (!previous) throw new HTTPException(404, { message: "User not found." });

    const [updated] = await db.update(users).set({ avatarURL: null }).where(eq(users.id, userID)).returning(userReturning);

    if (previous.avatarURL) await sweepOrphanedStorage(previous.avatarURL);

    return updated;
  }

  /**
   * Returns true when the given storage key is currently referenced by any
   * user's avatar. Used by the public uploads route to decide whether to
   * serve the file when it is not backed by an `attachments` row.
   */
  static async isAvatarStorageKey(storageKey: string): Promise<boolean> {
    const [row] = await db.select({ id: users.id }).from(users).where(eq(users.avatarURL, `/uploads/${storageKey}`)).limit(1);
    return !!row;
  }
}

/**
 * Removes an upload file from disk only if no attachment row and no user row
 * still references it. Content-addressed storage means an avatar's bytes
 * could legitimately also belong to a ticket attachment via dedup; deleting
 * blindly would 404 the attachment.
 */
async function sweepOrphanedStorage(url: string) {
  const storageKey = url.replace(/^\/uploads\//, "");
  if (!storageKey || storageKey === url) return;

  const [attachmentRef] = await db.select({ id: attachments.id }).from(attachments).where(eq(attachments.storageKey, storageKey)).limit(1);
  if (attachmentRef) return;

  const [userRef] = await db.select({ id: users.id }).from(users).where(eq(users.avatarURL, url)).limit(1);
  if (userRef) return;

  await deleteAttachment(storageKey);
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}
