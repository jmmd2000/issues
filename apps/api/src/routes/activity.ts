import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { validationHook } from "../lib/validation";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { requireProjectAccess, requireProjectRead } from "../middleware/projectAccess";
import { ActivityService } from "../services/activityService";
import { TicketService } from "../services/ticketService";
import { projectKeyParamSchema } from "./projects";

const activityParamSchema = projectKeyParamSchema.extend({
  num: z.coerce.number().int().positive(),
});

const projectActivityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const feedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const activity = new Hono()
  .get("/api/projects/:key/tickets/:num/activity", requireAuth, zValidator("param", activityParamSchema, validationHook), requireProjectAccess("member"), async (c) => {
    const project = c.get("project");
    const { num } = c.req.valid("param");

    const ticket = await TicketService.getTicketByNumber(project.id, num);
    const rows = await ActivityService.listForTicket(ticket.id);
    return c.json({ activity: rows });
  })
  .get(
    "/api/projects/:key/activity",
    optionalAuth,
    zValidator("param", projectKeyParamSchema, validationHook),
    zValidator("query", projectActivityQuerySchema, validationHook),
    requireProjectRead,
    async (c) => {
      const project = c.get("project");
      const { limit } = c.req.valid("query");

      const rows = await ActivityService.listForProject(project.id, limit, c.get("viewerCanSeePrivate"));
      return c.json({ activity: rows });
    }
  )
  .get("/api/feed", optionalAuth, zValidator("query", feedQuerySchema, validationHook), async (c) => {
    const { limit } = c.req.valid("query");
    const userID = c.get("userID");
    const events = await ActivityService.listGlobal(limit, { userID });
    return c.json({ events });
  });
