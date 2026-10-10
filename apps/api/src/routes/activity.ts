import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { validationHook } from "../lib/validation";
import { canView } from "../lib/access";
import { optionalAuth } from "../middleware/auth";
import { requireProjectRead } from "../middleware/projectAccess";
import { ActivityService } from "../services/activityService";
import { ProjectService } from "../services/projectService";
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
  .get("/api/projects/:key/tickets/:num/activity", optionalAuth, zValidator("param", activityParamSchema, validationHook), requireProjectRead, async c => {
    const project = c.get("project");
    const { num } = c.req.valid("param");

    const ticket = await TicketService.getTicketByNumber(project.id, num);
    if (!canView(c.get("role"), project, ticket)) {
      throw new HTTPException(404, { message: `Ticket #${num} not found` });
    }
    const rows = await ActivityService.listForTicket(ticket.id, c.get("role"));
    return c.json({ activity: rows });
  })
  .get(
    "/api/projects/:key/activity",
    optionalAuth,
    zValidator("param", projectKeyParamSchema, validationHook),
    zValidator("query", projectActivityQuerySchema, validationHook),
    requireProjectRead,
    async c => {
      const project = c.get("project");
      const { limit } = c.req.valid("query");

      const rows = await ActivityService.listForProject(project.id, limit, c.get("role"));
      return c.json({ activity: rows });
    }
  )
  .get("/api/feed", optionalAuth, zValidator("query", feedQuerySchema, validationHook), async c => {
    const { limit } = c.req.valid("query");
    const events = await ActivityService.listGlobal(limit, { role: c.get("role") });
    // The feed spans projects, so each card needs its own project's statuses,
    // labels and members to colour chips and show avatars.
    const projectKeys = [...new Set(events.map(event => event.project.key))];
    const lookups = await ProjectService.getActivityLookups(projectKeys);
    return c.json({ events, lookups });
  });
