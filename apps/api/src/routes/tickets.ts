import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { PRIORITIES } from "../lib/constants";
import { validationHook } from "../lib/validation";
import { requireAuth } from "../middleware/auth";
import { requireProjectAccess } from "../middleware/projectAccess";
import { TicketService, TICKET_LIST_SORT_COLUMNS } from "../services/ticketService";
import { projectKeyParamSchema } from "./projects";

const ticketParamSchema = projectKeyParamSchema.extend({
  num: z.coerce.number().int().positive(),
});

const createSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(50_000).optional(),
    statusID: z.uuid(),
    priority: z.enum(PRIORITIES).optional(),
    assigneeID: z.uuid().optional(),
    labelIDs: z.array(z.uuid()).optional(),
    parentTicketID: z.uuid().optional(),
  })
  .strict();

const patchSchema = createSchema
  .partial()
  .extend({
    assigneeID: z.uuid().nullable().optional(),
    parentTicketID: z.uuid().nullable().optional(),
  })
  .strict();

const moveSchema = z
  .object({
    statusID: z.uuid().optional(),
    beforeID: z.uuid().nullable().optional(),
    afterID: z.uuid().nullable().optional(),
  })
  .strict();

const ticketFilterQuerySchema = z.object({
  statusID: z.uuid().optional(),
  priority: z.enum(PRIORITIES).optional(),
  assigneeID: z.uuid().optional(),
});

const listQuerySchema = ticketFilterQuerySchema.extend({
  titleSearch: z.string().trim().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(TICKET_LIST_SORT_COLUMNS).default("updatedAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export const tickets = new Hono()
  .post(
    "/api/projects/:key/tickets",
    requireAuth,
    zValidator("json", createSchema, validationHook),
    zValidator("param", projectKeyParamSchema, validationHook),
    requireProjectAccess("member"),
    async (c) => {
      const body = c.req.valid("json");
      const project = c.get("project");
      const userID = c.get("userID");

      const ticket = await TicketService.createTicket({
        ...body,
        projectID: project.id,
        reporterID: userID,
      });
      return c.json({ ticket }, 201);
    }
  )
  .get(
    "/api/projects/:key/tickets",
    requireAuth,
    zValidator("param", projectKeyParamSchema, validationHook),
    zValidator("query", listQuerySchema, validationHook),
    requireProjectAccess("member"),
    async (c) => {
      const project = c.get("project");
      const query = c.req.valid("query");

      const tickets = await TicketService.listForProject(project.id, query);
      return c.json({ tickets });
    }
  )
  .get(
    "/api/projects/:key/tickets/board",
    requireAuth,
    zValidator("param", projectKeyParamSchema, validationHook),
    zValidator("query", ticketFilterQuerySchema, validationHook),
    requireProjectAccess("member"),
    async (c) => {
      const project = c.get("project");
      const query = c.req.valid("query");

      const tickets = await TicketService.listBoardForProject(project.id, query);
      return c.json({ tickets });
    }
  )
  .get("/api/projects/:key/tickets/:num", requireAuth, zValidator("param", ticketParamSchema, validationHook), requireProjectAccess("member"), async (c) => {
    const project = c.get("project");
    const { num } = c.req.valid("param");

    const ticket = await TicketService.getTicketByNumber(project.id, num);
    return c.json({ ticket });
  })
  .patch(
    "/api/projects/:key/tickets/:num",
    requireAuth,
    zValidator("json", patchSchema, validationHook),
    zValidator("param", ticketParamSchema, validationHook),
    requireProjectAccess("member"),
    async (c) => {
      const project = c.get("project");
      const userID = c.get("userID");
      const { num } = c.req.valid("param");
      const body = c.req.valid("json");

      const existing = await TicketService.getTicketByNumber(project.id, num);
      const ticket = await TicketService.patchTicket(existing.id, project.id, userID, body);
      return c.json({ ticket });
    }
  )
  .patch(
    "/api/projects/:key/tickets/:num/move",
    requireAuth,
    zValidator("json", moveSchema, validationHook),
    zValidator("param", ticketParamSchema, validationHook),
    requireProjectAccess("member"),
    async (c) => {
      const project = c.get("project");
      const userID = c.get("userID");
      const { num } = c.req.valid("param");
      const body = c.req.valid("json");

      const existing = await TicketService.getTicketByNumber(project.id, num);
      const ticket = await TicketService.moveTicket(existing.id, project.id, userID, body);
      return c.json({ ticket });
    }
  )
  .delete("/api/projects/:key/tickets/:num", requireAuth, zValidator("param", ticketParamSchema, validationHook), requireProjectAccess("member"), async (c) => {
    const project = c.get("project");
    const userID = c.get("userID");
    const { num } = c.req.valid("param");

    const existing = await TicketService.getTicketByNumber(project.id, num);
    await TicketService.softDeleteTicket(existing.id, project.id, userID);
    return c.body(null, 204);
  });
