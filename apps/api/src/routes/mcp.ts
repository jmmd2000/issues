import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { PRIORITIES, TICKET_REF_REGEX } from "@issues/shared";
import { validationHook } from "../lib/validation";
import { requireAuth } from "../middleware/auth";
import { ACTIVITY_LIMIT_MAX, McpService, SEARCH_LIMIT_MAX } from "../services/mcpService";

const refSchema = z.string().regex(TICKET_REF_REGEX);
const projectKeySchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2,6}$/)
  .transform((value) => value.toUpperCase());

const listParam = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((value) => {
    if (value === undefined) return undefined;
    const values = Array.isArray(value) ? value : [value];
    return values.flatMap((entry) =>
      String(entry)
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    );
  }, z.array(item).optional());

const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  project: projectKeySchema.optional(),
  status: listParam(z.string().trim().min(1).max(80)),
  priority: listParam(z.enum(PRIORITIES)),
  label: listParam(z.string().trim().min(1).max(80)),
  assignee: listParam(z.string().trim().min(1).max(100)),
  limit: z.coerce.number().int().min(1).max(SEARCH_LIMIT_MAX).optional(),
});

const refParamSchema = z.object({ ref: refSchema });

const createBodySchema = z
  .object({
    project: projectKeySchema,
    title: z.string().trim().min(1).max(200),
    description: z.string().max(50_000).optional(),
    statusSlug: z.string().trim().min(1).max(80).optional(),
    priority: z.enum(PRIORITIES).optional(),
    labels: z.array(z.string().trim().min(1).max(80)).optional(),
    assignee: z.string().trim().min(1).max(100).nullable().optional(),
  })
  .strict();

const patchBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(50_000).optional(),
    statusSlug: z.string().trim().min(1).max(80).optional(),
    priority: z.enum(PRIORITIES).optional(),
    labels: z.array(z.string().trim().min(1).max(80)).optional(),
    assignee: z.string().trim().min(1).max(100).nullable().optional(),
  })
  .strict();

const commentBodySchema = z
  .object({
    body: z.string().trim().min(1).max(10_000),
  })
  .strict();

const bulkBodySchema = z
  .object({
    refs: z.array(refSchema).min(1).max(100),
    patch: z
      .object({
        statusSlug: z.string().trim().min(1).max(80).optional(),
        priority: z.enum(PRIORITIES).optional(),
        labels: z.array(z.string().trim().min(1).max(80)).optional(),
        addLabels: z.array(z.string().trim().min(1).max(80)).optional(),
        removeLabels: z.array(z.string().trim().min(1).max(80)).optional(),
        assignee: z.string().trim().min(1).max(100).nullable().optional(),
      })
      .strict(),
  })
  .strict();

const activityQuerySchema = z.object({
  project: projectKeySchema,
  limit: z.coerce.number().int().min(1).max(ACTIVITY_LIMIT_MAX).optional(),
});

export const mcp = new Hono()
  .get("/api/mcp/projects", requireAuth, async (c) => {
    const userID = c.get("userID");
    const result = await McpService.listProjects(userID);
    return c.json(result);
  })
  .get("/api/mcp/tickets", requireAuth, zValidator("query", searchQuerySchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const query = c.req.valid("query");
    const result = await McpService.searchTickets(userID, {
      q: query.q,
      projectKey: query.project,
      statusSlugs: query.status,
      priorities: query.priority,
      labelNames: query.label,
      assigneeNames: query.assignee,
      limit: query.limit,
    });
    return c.json(result);
  })
  .post("/api/mcp/tickets", requireAuth, zValidator("json", createBodySchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const body = c.req.valid("json");
    const result = await McpService.createTicket(userID, {
      projectKey: body.project,
      title: body.title,
      description: body.description,
      statusSlug: body.statusSlug,
      priority: body.priority,
      labels: body.labels,
      assignee: body.assignee,
    });
    return c.json(result, 201);
  })
  .post("/api/mcp/tickets/bulk", requireAuth, zValidator("json", bulkBodySchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const { refs, patch } = c.req.valid("json");
    const result = await McpService.bulkUpdate(userID, refs, patch);
    return c.json(result);
  })
  .get("/api/mcp/tickets/:ref", requireAuth, zValidator("param", refParamSchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const { ref } = c.req.valid("param");
    const result = await McpService.getTicket(userID, ref);
    return c.json(result);
  })
  .patch("/api/mcp/tickets/:ref", requireAuth, zValidator("param", refParamSchema, validationHook), zValidator("json", patchBodySchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const { ref } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await McpService.patchTicket(userID, ref, body);
    return c.json(result);
  })
  .get("/api/mcp/tickets/:ref/comments", requireAuth, zValidator("param", refParamSchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const { ref } = c.req.valid("param");
    const result = await McpService.listComments(userID, ref);
    return c.json(result);
  })
  .post("/api/mcp/tickets/:ref/comments", requireAuth, zValidator("param", refParamSchema, validationHook), zValidator("json", commentBodySchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const { ref } = c.req.valid("param");
    const { body } = c.req.valid("json");
    const result = await McpService.addComment(userID, ref, body);
    return c.json(result, 201);
  })
  .get("/api/mcp/activity", requireAuth, zValidator("query", activityQuerySchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const { project, limit } = c.req.valid("query");
    const result = await McpService.getActivity(userID, project, limit);
    return c.json(result);
  });
