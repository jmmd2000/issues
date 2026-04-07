import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./db";
import { auth } from "./routes/auth";

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

const routes = app
  .get("/api/health", (c) => {
    return c.json({ status: "ok", timestamp: new Date().toISOString() });
  })
  .route("", auth);

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
