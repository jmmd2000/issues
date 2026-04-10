import z from "zod";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { validationHook } from "../lib/validation";
import { projectKeyParamSchema } from "./projects";
import { LabelService } from "../services/labelService";
import { requireProjectAccess } from "../middleware/projectAccess";
import { requireAuth } from "../middleware/auth";

const labelMutationSchema = z
  .object({
    name: z.string(),
    colour: z.string().regex(/^#[0-9a-fA-F]{3,6}$/, "Must be a 3 or 6-digit hex colour"),
  })
  .strict();

const labelParamSchema = projectKeyParamSchema.extend({ id: z.uuid() });

export const labels = new Hono()
  .post(
    "/api/projects/:key/labels",
    requireAuth,
    zValidator("json", labelMutationSchema, validationHook),
    zValidator("param", projectKeyParamSchema, validationHook),
    requireProjectAccess("owner"),
    async (c) => {
      const { id } = c.get("project");
      const { name, colour } = c.req.valid("json");
      const label = await LabelService.createLabel(name, colour, id);

      return c.json({ label }, 201);
    }
  )
  .get("/api/projects/:key/labels", requireAuth, zValidator("param", projectKeyParamSchema, validationHook), requireProjectAccess("member"), async (c) => {
    const { id } = c.get("project");
    const projectLabels = await LabelService.getLabels(id);

    return c.json({ labels: projectLabels }, 200);
  })
  .patch(
    "/api/projects/:key/labels/:id",
    requireAuth,
    zValidator("json", labelMutationSchema, validationHook),
    zValidator("param", labelParamSchema, validationHook),
    requireProjectAccess("owner"),
    async (c) => {
      const { id: projectID } = c.get("project");
      const { id: labelID } = c.req.valid("param");
      const { name, colour } = c.req.valid("json");
      const label = await LabelService.patchLabel(labelID, projectID, name, colour);

      return c.json({ label }, 200);
    }
  )
  .delete("/api/projects/:key/labels/:id", requireAuth, zValidator("param", labelParamSchema, validationHook), requireProjectAccess("owner"), async (c) => {
    const { id: projectID } = c.get("project");
    const { id: labelID } = c.req.valid("param");
    await LabelService.deleteLabel(labelID, projectID);

    return c.body(null, 204);
  });
