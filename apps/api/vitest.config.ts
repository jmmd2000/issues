import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    expect: { requireAssertions: true },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.integration.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["src/**/*.integration.test.ts"],
          fileParallelism: false,
          globalSetup: ["src/__tests__/setup/globalSetup.ts"],
          setupFiles: ["src/__tests__/setup/useTestDatabase.ts"],
        },
      },
    ],
  },
});
