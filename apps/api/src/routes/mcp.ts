import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { LINK_TYPES, PRIORITIES, TICKET_REF_REGEX } from "@issues/shared";
import { SEARCH_SORT_COLUMNS, SEARCH_SORT_DIRECTIONS } from "../lib/constants";
import { validationHook } from "../lib/validation";
import { requireAuth } from "../middleware/auth";
import { ACTIVITY_LIMIT_MAX, McpService, SEARCH_PER_PAGE_MAX } from "../services/mcpService";

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
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(SEARCH_PER_PAGE_MAX).optional(),
  sortBy: z.enum(SEARCH_SORT_COLUMNS).optional(),
  sortDirection: z.enum(SEARCH_SORT_DIRECTIONS).optional(),
});

const refParamSchema = z.object({ ref: refSchema });
const projectKeyParamSchema = z.object({ key: projectKeySchema });

const createBodySchema = z
  .object({
    project: projectKeySchema,
    title: z.string().trim().min(1).max(200),
    description: z.string().max(50_000).optional(),
    statusSlug: z.string().trim().min(1).max(80).optional(),
    priority: z.enum(PRIORITIES).optional(),
    labels: z.array(z.string().trim().min(1).max(80)).optional(),
    assignee: z.string().trim().min(1).max(100).nullable().optional(),
    parentTicketRef: refSchema.nullable().optional(),
  })
  .strict();

const patchBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(50_000).optional(),
    statusSlug: z.string().trim().min(1).max(80).optional(),
    priority: z.enum(PRIORITIES).optional(),
    labels: z.array(z.string().trim().min(1).max(80)).optional(),
    addLabels: z.array(z.string().trim().min(1).max(80)).optional(),
    removeLabels: z.array(z.string().trim().min(1).max(80)).optional(),
    assignee: z.string().trim().min(1).max(100).nullable().optional(),
    parentTicketRef: refSchema.nullable().optional(),
  })
  .strict();

const getTicketQuerySchema = z.object({
  full: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

const commentIDParamSchema = z.object({ id: z.uuid() });

const cloneBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(50_000).optional(),
    statusSlug: z.string().trim().min(1).max(80).optional(),
    priority: z.enum(PRIORITIES).optional(),
    labels: z.array(z.string().trim().min(1).max(80)).optional(),
    assignee: z.string().trim().min(1).max(100).nullable().optional(),
    copyAttachments: z.boolean().optional(),
  })
  .strict();

const commentBodySchema = z
  .object({
    body: z.string().trim().min(1).max(10_000),
  })
  .strict();

const activityQuerySchema = z.object({
  project: projectKeySchema,
  limit: z.coerce.number().int().min(1).max(ACTIVITY_LIMIT_MAX).optional(),
});

const linkBodySchema = z
  .object({
    target: refSchema,
    linkType: z.enum(LINK_TYPES),
  })
  .strict();

const linkQuerySchema = z.object({
  target: refSchema,
  linkType: z.enum(LINK_TYPES),
});

export const mcp = new Hono()
  .get("/api/mcp/projects", requireAuth, async (c) => {
    const userID = c.get("userID");
    const result = await McpService.listProjects(userID);
    return c.json(result);
  })
  .get("/api/mcp/projects/:key", requireAuth, zValidator("param", projectKeyParamSchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const { key } = c.req.valid("param");
    const result = await McpService.getProject(userID, key);
    return c.json(result);
  })
  .get("/api/mcp/projects/:key/members", requireAuth, zValidator("param", projectKeyParamSchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const { key } = c.req.valid("param");
    const result = await McpService.listMembers(userID, key);
    return c.json(result);
  })
  .get("/api/mcp/projects/:key/statuses", requireAuth, zValidator("param", projectKeyParamSchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const { key } = c.req.valid("param");
    const result = await McpService.listStatuses(userID, key);
    return c.json(result);
  })
  .get("/api/mcp/projects/:key/labels", requireAuth, zValidator("param", projectKeyParamSchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const { key } = c.req.valid("param");
    const result = await McpService.listLabels(userID, key);
    return c.json(result);
  })
  .get("/api/mcp/projects/:key/stats", requireAuth, zValidator("param", projectKeyParamSchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const { key } = c.req.valid("param");
    const result = await McpService.getStats(userID, key);
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
      page: query.page,
      perPage: query.perPage,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
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
      parentTicketRef: body.parentTicketRef,
    });
    return c.json(result, 201);
  })
  .get("/api/mcp/tickets/:ref", requireAuth, zValidator("param", refParamSchema, validationHook), zValidator("query", getTicketQuerySchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const { ref } = c.req.valid("param");
    const { full } = c.req.valid("query");
    const result = await McpService.getTicket(userID, ref, { full });
    return c.json(result);
  })
  .patch("/api/mcp/tickets/:ref", requireAuth, zValidator("param", refParamSchema, validationHook), zValidator("json", patchBodySchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const { ref } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await McpService.patchTicket(userID, ref, body);
    return c.json(result);
  })
  .delete("/api/mcp/tickets/:ref", requireAuth, zValidator("param", refParamSchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const { ref } = c.req.valid("param");
    const result = await McpService.softDeleteTicket(userID, ref);
    return c.json(result);
  })
  .post("/api/mcp/tickets/:ref/restore", requireAuth, zValidator("param", refParamSchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const { ref } = c.req.valid("param");
    const result = await McpService.restoreTicket(userID, ref);
    return c.json(result);
  })
  .post("/api/mcp/tickets/:ref/clone", requireAuth, zValidator("param", refParamSchema, validationHook), zValidator("json", cloneBodySchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const { ref } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await McpService.cloneTicket(userID, ref, body);
    return c.json(result, 201);
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
  .patch("/api/mcp/comments/:id", requireAuth, zValidator("param", commentIDParamSchema, validationHook), zValidator("json", commentBodySchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const { id } = c.req.valid("param");
    const { body } = c.req.valid("json");
    const result = await McpService.updateComment(userID, id, body);
    return c.json(result);
  })
  .delete("/api/mcp/comments/:id", requireAuth, zValidator("param", commentIDParamSchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const { id } = c.req.valid("param");
    await McpService.deleteComment(userID, id);
    return c.body(null, 204);
  })
  .get("/api/mcp/tickets/:ref/attachments", requireAuth, zValidator("param", refParamSchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const { ref } = c.req.valid("param");
    const result = await McpService.listAttachments(userID, ref);
    return c.json(result);
  })
  .get("/api/mcp/tickets/:ref/activity", requireAuth, zValidator("param", refParamSchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const { ref } = c.req.valid("param");
    const result = await McpService.getTicketActivity(userID, ref);
    return c.json(result);
  })
  .get("/api/mcp/tickets/:ref/links", requireAuth, zValidator("param", refParamSchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const { ref } = c.req.valid("param");
    const result = await McpService.listLinks(userID, ref);
    return c.json(result);
  })
  .post("/api/mcp/tickets/:ref/links", requireAuth, zValidator("param", refParamSchema, validationHook), zValidator("json", linkBodySchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const { ref } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await McpService.addLink(userID, ref, body);
    return c.json(result, 201);
  })
  .delete("/api/mcp/tickets/:ref/links", requireAuth, zValidator("param", refParamSchema, validationHook), zValidator("query", linkQuerySchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const { ref } = c.req.valid("param");
    const query = c.req.valid("query");
    await McpService.removeLink(userID, ref, query);
    return c.body(null, 204);
  })
  .get("/api/mcp/activity", requireAuth, zValidator("query", activityQuerySchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const { project, limit } = c.req.valid("query");
    const result = await McpService.getActivity(userID, project, limit);
    return c.json(result);
  });
