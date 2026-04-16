import z from "zod";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { validationHook } from "../lib/validation";
import { projectKeyParamSchema } from "./projects";
import { STATUS_CATEGORIES } from "../db/schema";
import { StatusService } from "../services/statusService";
import { requireProjectAccess } from "../middleware/projectAccess";
import { requireAuth } from "../middleware/auth";

const statusMutationSchema = z
  .object({
    name: z.string().min(1),
    slug: z.string().optional(),
    category: z.enum(STATUS_CATEGORIES).default("backlog"),
  })
  .strict();

const statusPatchSchema = z
  .object({
    name: z.string().optional(),
    slug: z.string().optional(),
  })
  .strict()
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "At least one field must be provided",
  });

const statusParamSchema = projectKeyParamSchema.extend({ id: z.uuid() });

const reorderSchema = z
  .object({
    order: z.array(
      z.object({
        id: z.uuid(),
        position: z.number().int().positive(),
        category: z.enum(STATUS_CATEGORIES).optional(),
      })
    ),
  })
  .strict();

const deleteSchema = z
  .object({
    reassignTo: z.uuid(),
  })
  .strict();

export const statuses = new Hono()
  .post(
    "/api/projects/:key/statuses",
    requireAuth,
    zValidator("json", statusMutationSchema, validationHook),
    zValidator("param", projectKeyParamSchema, validationHook),
    requireProjectAccess("owner"),
    async (c) => {
      const { id } = c.get("project");
      const { name, slug, category } = c.req.valid("json");
      const status = await StatusService.createStatus(name, category, id, slug);

      return c.json({ status }, 201);
    }
  )
  .get("/api/projects/:key/statuses", requireAuth, zValidator("param", projectKeyParamSchema, validationHook), requireProjectAccess("member"), async (c) => {
    const { id } = c.get("project");
    const projectStatuses = await StatusService.getStatuses(id);

    return c.json({ statuses: projectStatuses }, 200);
  })
  .patch(
    "/api/projects/:key/statuses/reorder",
    requireAuth,
    zValidator("json", reorderSchema, validationHook),
    zValidator("param", projectKeyParamSchema, validationHook),
    requireProjectAccess("owner"),
    async (c) => {
      const { id: projectID } = c.get("project");
      const { order } = c.req.valid("json");
      const statuses = await StatusService.reorderStatuses(projectID, order);

      return c.json({ statuses }, 200);
    }
  )
  .patch(
    "/api/projects/:key/statuses/:id",
    requireAuth,
    zValidator("json", statusPatchSchema, validationHook),
    zValidator("param", statusParamSchema, validationHook),
    requireProjectAccess("owner"),
    async (c) => {
      const { id: projectID } = c.get("project");
      const { id: statusID } = c.req.valid("param");
      const patch = c.req.valid("json");
      const status = await StatusService.patchStatus(statusID, projectID, patch);

      return c.json({ status }, 200);
    }
  )
  .delete(
    "/api/projects/:key/statuses/:id",
    requireAuth,
    zValidator("json", deleteSchema, validationHook),
    zValidator("param", statusParamSchema, validationHook),
    requireProjectAccess("owner"),
    async (c) => {
      const { id: projectID } = c.get("project");
      const { id: statusID } = c.req.valid("param");
      const { reassignTo } = c.req.valid("json");
      await StatusService.deleteStatus(statusID, projectID, reassignTo);

      return c.body(null, 204);
    }
  );
