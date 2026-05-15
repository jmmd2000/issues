import { Readable } from "node:stream";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { optionalAuth } from "../middleware/auth";
import { AttachmentService } from "../services/attachmentService";
import { canAccessProject } from "../services/accessService";
import { UserService } from "../services/userService";
import { STORAGE_KEY_RE, attachmentSize, readAttachmentStream } from "../lib/storage";

const AVATAR_ACCESS = { isPublic: true, projectIDs: [] as string[], mimeType: "image/webp", filename: "avatar.webp", isImage: true } as const;

export const uploads = new Hono().get("/uploads/:storageKey", optionalAuth, async (c) => {
  const storageKey = c.req.param("storageKey");
  if (!STORAGE_KEY_RE.test(storageKey)) {
    throw new HTTPException(400, { message: "Invalid attachment key." });
  }

  const attachmentAccess = await AttachmentService.resolveAccess(storageKey);
  const access = attachmentAccess ?? ((await UserService.isAvatarStorageKey(storageKey)) ? AVATAR_ACCESS : null);
  if (!access) throw new HTTPException(404, { message: "Attachment not found." });

  const userID = c.get("userID");
  if (!access.isPublic) {
    if (!userID) throw new HTTPException(404, { message: "Attachment not found." });
    let isAccessible = false;
    for (const projectID of access.projectIDs) {
      if (await canAccessProject(userID, projectID)) {
        isAccessible = true;
        break;
      }
    }
    if (!isAccessible) throw new HTTPException(404, { message: "Attachment not found." });
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
