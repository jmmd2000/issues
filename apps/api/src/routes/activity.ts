import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { validationHook } from "../lib/validation";
import { requireAuth } from "../middleware/auth";
import { requireProjectAccess } from "../middleware/projectAccess";
import { ActivityService } from "../services/activityService";
import { TicketService } from "../services/ticketService";
import { projectKeyParamSchema } from "./projects";

const activityParamSchema = projectKeyParamSchema.extend({
  num: z.coerce.number().int().positive(),
});

export const activity = new Hono().get(
  "/api/projects/:key/tickets/:num/activity",
  requireAuth,
  zValidator("param", activityParamSchema, validationHook),
  requireProjectAccess("member"),
  async (c) => {
    const project = c.get("project");
    const { num } = c.req.valid("param");

    const ticket = await TicketService.getTicketByNumber(project.id, num);
    const rows = await ActivityService.listForTicket(ticket.id);
    return c.json({ activity: rows });
  }
);
