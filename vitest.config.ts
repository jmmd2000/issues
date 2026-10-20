import fs from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { defineConfig } from "vitest/config";

const apiRoot = path.resolve(import.meta.dirname, "apps/api");
const mcpRoot = path.resolve(import.meta.dirname, "apps/mcp");

/** Reads the API's `.env` for its test projects only, so no other project sees those values. */
function readApiEnv(): Record<string, string> {
  const file = path.join(apiRoot, ".env");
  if (!fs.existsSync(file)) return { UPLOADS_DIR: path.join(apiRoot, "data", "uploads") };
  const entries = Object.entries(parseEnv(fs.readFileSync(file, "utf8")));
  const values = Object.fromEntries(entries.filter((entry): entry is [string, string] => entry[1] !== undefined));
  return { ...values, UPLOADS_DIR: path.resolve(apiRoot, values.UPLOADS_DIR ?? "./data/uploads") };
}

const apiTest = {
  expect: { requireAssertions: true },
  env: readApiEnv(),
};

export default defineConfig({
  test: {
    reporters: ["dot"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["apps/*/src/**/*.{ts,svelte}", "packages/*/src/**/*.ts"],
      exclude: ["**/__tests__/**", "**/*.test.ts", "**/*.test-d.ts", "**/*.d.ts"],
    },
    projects: [
      "apps/web/vitest.client.config.ts",
      "apps/web/vitest.server.config.ts",
      {
        root: mcpRoot,
        test: { name: "mcp-unit", expect: { requireAssertions: true } },
      },
      {
        root: apiRoot,
        test: {
          ...apiTest,
          name: "api-unit",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.integration.test.ts"],
        },
      },
      {
        root: apiRoot,
        test: {
          ...apiTest,
          name: "api-integration",
          include: ["src/**/*.integration.test.ts"],
          fileParallelism: false,
          globalSetup: ["src/__tests__/setup/globalSetup.ts"],
          setupFiles: ["src/__tests__/setup/useTestDatabase.ts"],
        },
      },
    ],
  },
});
