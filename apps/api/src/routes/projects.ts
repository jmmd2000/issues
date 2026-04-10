import { z } from "zod";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { validationHook } from "../lib/validation";
import { ProjectService } from "../services/projectService";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { requireProjectAccess } from "../middleware/projectAccess";

const projectKeySchema = z
  .string()
  .min(2)
  .max(6)
  .transform((v) => v.toUpperCase());

const projectBaseSchema = z.object({
  name: z.string(),
  description: z.string(),
  visibility: z.enum(["public", "private"]),
});

const createProjectSchema = projectBaseSchema
  .extend({
    key: projectKeySchema,
    repo: z.url().nullable().default(null),
    stack: z.array(z.string()).default([]),
  })
  .strict();

const patchProjectSchema = projectBaseSchema
  .extend({
    repo: z.url().nullable(),
    stack: z.array(z.string()),
    metadata: z.record(z.string(), z.unknown()),
  })
  .strict();

const projectKeyParamSchema = z.object({
  key: projectKeySchema,
});

export const projects = new Hono()
  .post("/api/projects/create", requireAuth, zValidator("json", createProjectSchema, validationHook), async (c) => {
    const data = c.req.valid("json");
    const userID = c.get("userID");
    const project = await ProjectService.createProject({ ...data, ownerID: userID });

    return c.json({ project }, 201);
  })
  .get("/api/projects/", optionalAuth, async (c) => {
    const userID = c.get("userID");
    const projects = await ProjectService.getAllProjects(userID);

    return c.json({ projects }, 200);
  })
  .get("/api/projects/:key", optionalAuth, zValidator("param", projectKeyParamSchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const { key } = c.req.valid("param");
    const project = await ProjectService.getProjectByKey(userID, key);

    return c.json({ project }, 200);
  })
  .patch(
    "/api/projects/:key",
    requireAuth,
    zValidator("json", patchProjectSchema, validationHook),
    zValidator("param", projectKeyParamSchema, validationHook),
    requireProjectAccess("member"),
    async (c) => {
      const data = c.req.valid("json");
      const { id } = c.get("project");
      const project = await ProjectService.patchProject(id, data);

      return c.json({ project }, 200);
    }
  )
  .delete("/api/projects/:key", requireAuth, zValidator("param", projectKeyParamSchema, validationHook), requireProjectAccess("owner"), async (c) => {
    const { id } = c.get("project");
    await ProjectService.deleteProject(id);

    return c.body(null, 204);
  });
