import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { BuildService } from "../services/buildService";

export const build = new Hono().get("/api/build", requireAuth, async c => {
  const info = await BuildService.getBuildInfo();

  return c.json({ build: info }, 200);
});
