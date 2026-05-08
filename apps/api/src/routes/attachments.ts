import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { validationHook } from "../lib/validation";
import { requireAuth } from "../middleware/auth";
import { requireProjectAccess } from "../middleware/projectAccess";
import { AttachmentService } from "../services/attachmentService";
import { TicketService } from "../services/ticketService";
import { projectKeyParamSchema } from "./projects";

const ticketParamSchema = projectKeyParamSchema.extend({
  num: z.coerce.number().int().positive(),
});

const attachmentParamSchema = projectKeyParamSchema.extend({
  id: z.uuid(),
});

export const attachments = new Hono()
  .get("/api/projects/:key/tickets/:num/attachments", requireAuth, zValidator("param", ticketParamSchema, validationHook), requireProjectAccess("member"), async (c) => {
    const project = c.get("project");
    const { num } = c.req.valid("param");
    const ticket = await TicketService.getTicketByNumber(project.id, num);
    const list = await AttachmentService.listForTicket(ticket.id);
    return c.json({ attachments: list });
  })
  .post("/api/projects/:key/tickets/:num/attachments", requireAuth, zValidator("param", ticketParamSchema, validationHook), requireProjectAccess("member"), async (c) => {
    const project = c.get("project");
    const userID = c.get("userID");
    const { num } = c.req.valid("param");

    const body = await c.req.parseBody({ all: false });
    const file = body["file"];
    if (!(file instanceof File)) {
      throw new HTTPException(400, { message: "Multipart `file` field is required." });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const ticket = await TicketService.getTicketByNumber(project.id, num);

    const attachment = await AttachmentService.uploadForTicket({
      ticketID: ticket.id,
      uploaderID: userID,
      filename: file.name || "upload",
      mimeType: file.type || "application/octet-stream",
      bytes,
    });

    return c.json({ attachment }, 201);
  })
  .delete("/api/projects/:key/attachments/:id", requireAuth, zValidator("param", attachmentParamSchema, validationHook), requireProjectAccess("member"), async (c) => {
    const project = c.get("project");
    const userID = c.get("userID");
    const { id } = c.req.valid("param");
    await AttachmentService.delete(id, project.id, userID);
    return c.body(null, 204);
  });
