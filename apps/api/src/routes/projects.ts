import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { validationHook } from "../lib/validation";
import { ProjectService } from "../services/projectService";
import { optionalAuth, requireAuth } from "../middleware/auth";

const projectKeySchema = z
  .string()
  .min(2)
  .max(6)
  .transform((v) => v.toUpperCase());

const createProjectSchema = z.object({
  key: projectKeySchema,
  name: z.string(),
  description: z.string(),
  visibility: z.enum(["public", "private"]),
});
const getProjectByKeySchema = z.object({
  key: projectKeySchema,
});

export const projects = new Hono()
  .post("/api/projects/create", requireAuth, zValidator("json", createProjectSchema, validationHook), async (c) => {
    const { key, name, description, visibility } = c.req.valid("json");
    const userID = c.get("userID");
    const project = await ProjectService.createProject(key, name, description, visibility, userID);

    return c.json({ project }, 201);
  })
  .get("/api/projects/", optionalAuth, async (c) => {
    const userID = c.get("userID");
    const projects = await ProjectService.getAllProjects(userID);

    return c.json({ projects }, 200);
  })
  .get("/api/projects/:key", optionalAuth, zValidator("param", getProjectByKeySchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const { key } = c.req.valid("param");
    const project = await ProjectService.getProjectByKey(userID, key);

    return c.json({ project }, 200);
  });
