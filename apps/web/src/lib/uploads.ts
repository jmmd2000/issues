import type { Attachment } from "@issues/api";
import { PUBLIC_API_URL } from "$env/static/public";

/**
 * Uploads a single file as a ticket attachment via multipart/form-data. The
 * Hono RPC client doesn't carry FormData, so this uses the native fetch with
 * `credentials: "include"` so the session cookie tags along.
 *
 * Throws an Error whose `.message` is the server-supplied reason on non-2xx.
 */
export async function uploadTicketAttachment(projectKey: string, ticketNumber: number, file: File): Promise<Attachment> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${PUBLIC_API_URL}/api/projects/${projectKey}/tickets/${ticketNumber}/attachments`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(data.message ?? `Upload failed (${res.status}).`);
  }

  const { attachment }: { attachment: Attachment } = await res.json();
  return attachment;
}

/**
 * Resolves an attachment URL into an absolute one. Server returns relative
 * `/uploads/<key>`, but `<img>` and link clicks need to hit the API origin.
 */
export function attachmentURL(attachment: { url: string }): string {
  return attachment.url.startsWith("http") ? attachment.url : `${PUBLIC_API_URL}${attachment.url}`;
}
