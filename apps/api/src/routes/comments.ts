import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { validationHook } from "../lib/validation";
import { requireAuth } from "../middleware/auth";
import { requireProjectAccess } from "../middleware/projectAccess";
import { CommentService } from "../services/commentService";
import { TicketService } from "../services/ticketService";
import { projectKeyParamSchema } from "./projects";

const commentParamSchema = projectKeyParamSchema.extend({
  num: z.coerce.number().int().positive(),
});

const commentIDParamSchema = commentParamSchema.extend({
  id: z.uuid(),
});

const commentBodySchema = z
  .object({
    body: z.string().trim().min(1, "Comment cannot be empty.").max(10_000),
  })
  .strict();

export const comments = new Hono()
  .get("/api/projects/:key/tickets/:num/comments", requireAuth, zValidator("param", commentParamSchema, validationHook), requireProjectAccess("member"), async (c) => {
    const project = c.get("project");
    const { num } = c.req.valid("param");

    const ticket = await TicketService.getTicketByNumber(project.id, num);
    const list = await CommentService.listForTicket(ticket.id);
    return c.json({ comments: list });
  })
  .post(
    "/api/projects/:key/tickets/:num/comments",
    requireAuth,
    zValidator("json", commentBodySchema, validationHook),
    zValidator("param", commentParamSchema, validationHook),
    requireProjectAccess("member"),
    async (c) => {
      const project = c.get("project");
      const userID = c.get("userID");
      const { num } = c.req.valid("param");
      const { body } = c.req.valid("json");

      const ticket = await TicketService.getTicketByNumber(project.id, num);
      const comment = await CommentService.createComment(ticket.id, userID, body);
      return c.json({ comment }, 201);
    }
  )
  .patch(
    "/api/projects/:key/tickets/:num/comments/:id",
    requireAuth,
    zValidator("json", commentBodySchema, validationHook),
    zValidator("param", commentIDParamSchema, validationHook),
    requireProjectAccess("member"),
    async (c) => {
      const project = c.get("project");
      const userID = c.get("userID");
      const { num, id } = c.req.valid("param");
      const { body } = c.req.valid("json");

      const ticket = await TicketService.getTicketByNumber(project.id, num);
      const comment = await CommentService.updateComment(id, ticket.id, userID, body);
      return c.json({ comment });
    }
  )
  .delete("/api/projects/:key/tickets/:num/comments/:id", requireAuth, zValidator("param", commentIDParamSchema, validationHook), requireProjectAccess("member"), async (c) => {
    const project = c.get("project");
    const userID = c.get("userID");
    const { num, id } = c.req.valid("param");

    const ticket = await TicketService.getTicketByNumber(project.id, num);
    await CommentService.softDeleteComment(id, ticket.id, userID);
    return c.body(null, 204);
  });
