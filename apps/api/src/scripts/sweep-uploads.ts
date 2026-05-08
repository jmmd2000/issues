import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import { and, eq, lt, ne, sql } from "drizzle-orm";
import { db } from "../db";
import { attachments, comments, projects, tickets } from "../db/schema";
import { deleteAttachment, getUploadsDir, listStoredKeys, STORAGE_KEY_RE } from "../lib/storage";

const ORPHAN_AGE_HOURS = 24;
const MAX_UPLOADS_BYTES_DEFAULT = 20_000_000_000;

type Orphan = typeof attachments.$inferSelect & { ownerLabel: string };

/**
 * Resolves a human-readable owner label for an orphan attachment so the sweep
 * log says where the file used to live. Ticket-scoped attachments resolve to
 * `KEY-N`; comment-scoped attachments resolve to `KEY-N (comment)`; anything
 * dangling falls back to a row-id reference.
 */
async function resolveOwnerLabel(row: typeof attachments.$inferSelect): Promise<string> {
  if (row.ticketID) {
    const [hit] = await db.select({ key: projects.key, number: tickets.number }).from(tickets).innerJoin(projects, eq(tickets.projectID, projects.id)).where(eq(tickets.id, row.ticketID)).limit(1);
    if (hit) return `${hit.key}-${hit.number}`;
  }

  if (row.commentID) {
    const [hit] = await db
      .select({ key: projects.key, number: tickets.number })
      .from(comments)
      .innerJoin(tickets, eq(comments.ticketID, tickets.id))
      .innerJoin(projects, eq(tickets.projectID, projects.id))
      .where(eq(comments.id, row.commentID))
      .limit(1);
    if (hit) return `${hit.key}-${hit.number} (comment)`;
  }

  return `attachment ${row.id.slice(0, 8)}`;
}

async function findOrphanRows(): Promise<Orphan[]> {
  // Stale attachments — older than ORPHAN_AGE_HOURS — that aren't referenced
  // by any ticket body or comment body, and whose contentHash is not held by
  // any other live row.
  const stale = await db
    .select()
    .from(attachments)
    .where(lt(attachments.createdAt, sql`now() - interval '${sql.raw(String(ORPHAN_AGE_HOURS))} hours'`));

  const orphans: Orphan[] = [];
  for (const row of stale) {
    const [ticketHits] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tickets)
      .where(sql`${tickets.description} ILIKE ${"%/" + row.storageKey + "%"}`);
    const [commentHits] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(comments)
      .where(sql`${comments.body} ILIKE ${"%/" + row.storageKey + "%"}`);
    const [siblingHits] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(attachments)
      .where(and(eq(attachments.contentHash, row.contentHash), ne(attachments.id, row.id)));

    if (ticketHits.count === 0 && commentHits.count === 0 && siblingHits.count === 0) {
      const ownerLabel = await resolveOwnerLabel(row);
      orphans.push({ ...row, ownerLabel });
    }
  }
  return orphans;
}

async function pruneOrphanFiles(): Promise<string[]> {
  // Files on disk that no DB row references at all — drop them.
  const onDisk = await listStoredKeys();
  if (onDisk.length === 0) return [];

  const known = await db.select({ storageKey: attachments.storageKey }).from(attachments);
  const knownSet = new Set(known.map((r) => r.storageKey));

  const removed: string[] = [];
  for (const key of onDisk) {
    if (!knownSet.has(key)) {
      await deleteAttachment(key);
      removed.push(key);
    }
  }
  return removed;
}

function summariseQuota(): { fileCount: number; totalBytes: number; quotaBytes: number; pct: string } {
  const dir = getUploadsDir();
  const entries = fs.readdirSync(dir).filter((name) => STORAGE_KEY_RE.test(name));
  let totalBytes = 0;
  for (const name of entries) {
    totalBytes += fs.statSync(path.join(dir, name)).size;
  }
  const quotaBytes = Number(process.env.MAX_UPLOADS_BYTES) || MAX_UPLOADS_BYTES_DEFAULT;
  const pct = ((totalBytes / quotaBytes) * 100).toFixed(1);
  return { fileCount: entries.length, totalBytes, quotaBytes, pct };
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(2)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(2)} KB`;
  return `${bytes} B`;
}

async function main() {
  const orphans = await findOrphanRows();
  let freedBytes = 0;

  for (const row of orphans) {
    await db.delete(attachments).where(eq(attachments.id, row.id));
    await deleteAttachment(row.storageKey);
    freedBytes += row.sizeBytes;
    console.log(`[sweep]   removed "${row.filename}" (${formatBytes(row.sizeBytes)}, ${row.storageKey}) from ${row.ownerLabel}`);
  }
  console.log(`[sweep] removed ${orphans.length} orphan attachment rows, freed ${formatBytes(freedBytes)}`);

  const prunedFiles = await pruneOrphanFiles();
  for (const key of prunedFiles) {
    console.log(`[sweep]   removed orphan file ${key} (no DB row)`);
  }
  if (prunedFiles.length > 0) {
    console.log(`[sweep] removed ${prunedFiles.length} orphan files (no DB row)`);
  }

  const summary = summariseQuota();
  console.log(`[sweep] uploads: ${summary.fileCount} files, ${formatBytes(summary.totalBytes)} total (${summary.pct}% of ${formatBytes(summary.quotaBytes)} quota)`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[sweep] failed:", err);
    process.exit(1);
  });
