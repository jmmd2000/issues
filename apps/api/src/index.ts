import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

const routes = app.get("/api/health", c => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

export type AppType = typeof routes;

const port = 4000;

serve({ fetch: routes.fetch, port }, info => {
  console.log(`Server running at http://localhost:${info.port}`);
});

export default app;
