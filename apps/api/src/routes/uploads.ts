import { Readable } from "node:stream";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { projectMembers } from "../db/schema";
import { optionalAuth } from "../middleware/auth";
import { AttachmentService } from "../services/attachmentService";
import { STORAGE_KEY_RE, attachmentSize, readAttachmentStream } from "../lib/storage";

export const uploads = new Hono().get("/uploads/:storageKey", optionalAuth, async (c) => {
  const storageKey = c.req.param("storageKey");
  if (!STORAGE_KEY_RE.test(storageKey)) {
    throw new HTTPException(400, { message: "Invalid attachment key." });
  }

  const access = await AttachmentService.resolveAccess(storageKey);
  if (!access) throw new HTTPException(404, { message: "Attachment not found." });

  const userID = c.get("userID");
  if (!access.isPublic) {
    if (!userID) throw new HTTPException(404, { message: "Attachment not found." });
    const memberRows = await db.select({ projectID: projectMembers.projectID }).from(projectMembers).where(eq(projectMembers.userID, userID));
    const memberSet = new Set(memberRows.map((row) => row.projectID));
    const isMember = access.projectIDs.some((id) => memberSet.has(id));
    if (!isMember) throw new HTTPException(404, { message: "Attachment not found." });
  }

  const size = attachmentSize(storageKey);
  if (size === null) throw new HTTPException(404, { message: "Attachment not found on disk." });

  const headers: Record<string, string> = {
    "Content-Type": access.mimeType,
    "Content-Length": String(size),
    "Content-Disposition": `${access.isImage ? "inline" : "attachment"}; filename="${quoteFilename(access.filename)}"`,
    "Cache-Control": `${access.isPublic ? "public" : "private"}, max-age=31536000, immutable`,
    "X-Content-Type-Options": "nosniff",
  };

  const webStream = Readable.toWeb(readAttachmentStream(storageKey)) as ReadableStream<Uint8Array>;
  return new Response(webStream, { status: 200, headers });
});

function quoteFilename(name: string): string {
  return name.replace(/[\r\n"]/g, "_");
}
