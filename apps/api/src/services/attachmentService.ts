import { and, asc, count, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../db";
import { attachments, tickets } from "../db/schema";
import { processFile, processImage, type ProcessedFile, type ProcessedImage } from "../lib/images";
import { writeAttachment } from "../lib/storage";
import type { Attachment, AttachmentRow } from "../lib/types";
import { ActivityService } from "./activityService";

const MAX_ATTACHMENTS_PER_TICKET = 10;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const DEFAULTS = {
  MAX_IMAGE_BYTES: 10_000_000,
  MAX_FILE_BYTES: 10_000_000,
  MAX_IMAGE_OUTPUT_BYTES: 1_000_000,
  MAX_UPLOADS_BYTES: 20_000_000_000,
} as const;

function caps() {
  return {
    maxImageBytes: envInt("MAX_IMAGE_BYTES", DEFAULTS.MAX_IMAGE_BYTES),
    maxFileBytes: envInt("MAX_FILE_BYTES", DEFAULTS.MAX_FILE_BYTES),
    maxImageOutputBytes: envInt("MAX_IMAGE_OUTPUT_BYTES", DEFAULTS.MAX_IMAGE_OUTPUT_BYTES),
    maxUploadsBytes: envInt("MAX_UPLOADS_BYTES", DEFAULTS.MAX_UPLOADS_BYTES),
  };
}

type UploaderRow = { id: string; name: string; avatarURL: string | null };
type RowWithUploader = AttachmentRow & { uploader: UploaderRow };

function shape(row: RowWithUploader): Attachment {
  return {
    id: row.id,
    ticketID: row.ticketID,
    commentID: row.commentID,
    uploaderID: row.uploaderID,
    filename: row.filename,
    storageKey: row.storageKey,
    contentHash: row.contentHash,
    sizeBytes: row.sizeBytes,
    width: row.width,
    height: row.height,
    mimeType: row.mimeType,
    isImage: row.isImage,
    createdAt: row.createdAt.toISOString(),
    url: `/uploads/${row.storageKey}`,
    uploader: row.uploader,
  };
}

export class AttachmentService {
  /**
   * Lists every attachment for a ticket in upload order, with the uploader
   * joined for the avatar/name surface in the UI.
   */
  static async listForTicket(ticketID: string): Promise<Attachment[]> {
    const rows = await db.query.attachments.findMany({
      where: eq(attachments.ticketID, ticketID),
      orderBy: [asc(attachments.createdAt)],
      with: { uploader: { columns: { id: true, name: true, avatarURL: true } } },
    });
    return rows.map(shape);
  }

  /**
   * Validates, processes, deduplicates, and stores an upload for a ticket.
   * Image bytes go through sharp + WebP. Non-image bytes are stored as-is
   * after extension-allow-list validation. Per-ticket count, per-file size,
   * and total-storage quotas are all enforced. The activity row is written on
   * the same transaction so audit log and content commit atomically.
   */
  static async uploadForTicket(input: { ticketID: string; uploaderID: string; filename: string; mimeType: string; bytes: Buffer }): Promise<Attachment> {
    const { ticketID, uploaderID, filename, mimeType, bytes } = input;
    const limits = caps();

    let processed: ProcessedImage | ProcessedFile;
    let isImage: boolean;
    let width: number | null = null;
    let height: number | null = null;

    if (mimeType.startsWith("image/")) {
      if (bytes.length > limits.maxImageBytes) {
        throw new HTTPException(413, { message: `Image exceeds raw limit of ${formatBytes(limits.maxImageBytes)}.` });
      }
      const image = await processImage(bytes);
      if (image.sizeBytes > limits.maxImageOutputBytes) {
        throw new HTTPException(413, { message: `Processed image still exceeds ${formatBytes(limits.maxImageOutputBytes)} after resizing.` });
      }
      processed = image;
      isImage = true;
      width = image.width;
      height = image.height;
    } else {
      if (bytes.length > limits.maxFileBytes) {
        throw new HTTPException(413, { message: `File exceeds limit of ${formatBytes(limits.maxFileBytes)}.` });
      }
      processed = processFile(bytes, filename, mimeType);
      isImage = false;
    }

    const storageKey = `${processed.contentHash}${processed.extension}`;

    return await db.transaction(async (tx) => {
      const [{ value: existingCount }] = await tx.select({ value: count() }).from(attachments).where(eq(attachments.ticketID, ticketID));
      if (existingCount >= MAX_ATTACHMENTS_PER_TICKET) {
        throw new HTTPException(409, { message: `A ticket can have at most ${MAX_ATTACHMENTS_PER_TICKET} attachments.` });
      }

      const dedupHit = await tx.query.attachments.findFirst({
        where: eq(attachments.contentHash, processed.contentHash),
      });

      if (!dedupHit) {
        // Quota check only for new bytes; dedup hits are already counted.
        const [{ total }] = await tx.select({ total: sql<number>`coalesce(sum(${attachments.sizeBytes}), 0)::bigint` }).from(attachments);
        if (Number(total) + processed.sizeBytes > limits.maxUploadsBytes) {
          throw new HTTPException(507, {
            message: `Storage quota reached: ${formatBytes(limits.maxUploadsBytes)} total. Sweep old attachments or raise MAX_UPLOADS_BYTES.`,
          });
        }
        await writeAttachment(storageKey, processed.bytes);
      }

      const [inserted] = await tx
        .insert(attachments)
        .values({
          ticketID,
          uploaderID,
          filename,
          storageKey,
          contentHash: processed.contentHash,
          sizeBytes: processed.sizeBytes,
          width,
          height,
          mimeType: processed.mimeType,
          isImage,
        })
        .returning();

      const uploader = await tx.query.users.findFirst({
        where: (user, { eq }) => eq(user.id, uploaderID),
        columns: { id: true, name: true, avatarURL: true },
      });
      // FK on attachments.uploader_id guarantees the user exists at this point.
      await ActivityService.logAttachment(tx, { userID: uploaderID, ticketID, kind: "added", attachment: inserted });

      return shape({ ...inserted, uploader: uploader! });
    });
  }

  /**
   * Hard-deletes an attachment row. Only the original uploader can delete; any
   * other member receives 403. The on-disk file is left for the sweep script -
   * that avoids races where two concurrent deletes both try to unlink. Returns
   * 404 if the row's ticket isn't in the requested project.
   */
  static async delete(attachmentID: string, projectID: string, requestingUserID: string): Promise<void> {
    await db.transaction(async (tx) => {
      const row = await tx.query.attachments.findFirst({
        where: eq(attachments.id, attachmentID),
        with: {
          ticket: { columns: { id: true, projectID: true } },
        },
      });

      if (!row || !row.ticket) throw new HTTPException(404, { message: `Attachment ${attachmentID} not found.` });
      if (row.ticket.projectID !== projectID) {
        throw new HTTPException(404, { message: `Attachment ${attachmentID} not found.` });
      }
      if (row.uploaderID !== requestingUserID) {
        throw new HTTPException(403, { message: "Only the uploader can delete this attachment." });
      }

      await tx.delete(attachments).where(eq(attachments.id, attachmentID));
      await ActivityService.logAttachment(tx, { userID: requestingUserID, ticketID: row.ticket.id, kind: "removed", attachment: { id: row.id, filename: row.filename } });
    });
  }

  /**
   * Returns visibility info for an attachment surfaced via /uploads/:storageKey.
   * Used by the route to decide whether to gate by session or serve openly.
   */
  static async resolveAccess(storageKey: string): Promise<{ found: boolean; isPublic: boolean; projectIDs: string[]; mimeType: string; filename: string; isImage: boolean } | null> {
    const rows = await db
      .select({
        mimeType: attachments.mimeType,
        filename: attachments.filename,
        isImage: attachments.isImage,
        ticketProjectID: tickets.projectID,
        ticketVisibility: tickets.visibility,
        projectVisibility: sql<string>`(select visibility from projects where id = ${tickets.projectID})`,
      })
      .from(attachments)
      .innerJoin(tickets, eq(attachments.ticketID, tickets.id))
      .where(eq(attachments.storageKey, storageKey));

    if (rows.length === 0) return null;

    const isPublic = rows.some((row) => row.ticketVisibility === "public" && row.projectVisibility === "public");
    return {
      found: true,
      isPublic,
      projectIDs: [...new Set(rows.map((row) => row.ticketProjectID))],
      mimeType: rows[0].mimeType,
      filename: rows[0].filename,
      isImage: rows[0].isImage,
    };
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}
