import { defineConfig } from "drizzle-kit";
import { getEnv } from "./src/lib/env";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: getEnv().DATABASE_URL,
  },
});
