import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./db";
import { auth } from "./routes/auth";
import { projects } from "./routes/projects";
import { labels } from "./routes/labels";
import { statuses } from "./routes/statuses";

const app = new Hono();

if (process.env.NODE_ENV !== "test") {
  app.use("*", logger());
}

app.use("*", cors());

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }
  return c.json({ message: "Internal server error" }, 500);
});

const routes = app
  .get("/api/health", (c) => {
    return c.json({ status: "ok", timestamp: new Date().toISOString() });
  })
  .route("", auth)
  .route("", projects)
  .route("", labels)
  .route("", statuses);

export type AppType = typeof routes;

async function start() {
  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete...");

  const port = Number(process.env.PORT) || 4000;

  serve({ fetch: routes.fetch, port }, (info) => {
    console.log(`Server running at http://localhost:${info.port}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  start().catch((error) => {
    console.error("Failed to start:", error);
    process.exit(1);
  });
}

export default app;
