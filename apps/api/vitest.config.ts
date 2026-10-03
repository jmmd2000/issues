import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    expect: { requireAssertions: true },
    fileParallelism: false,
    include: ["src/**/*.test.ts"],
    globalSetup: ["src/__tests__/setup/globalSetup.ts"],
    setupFiles: ["src/__tests__/setup/useTestDatabase.ts"],
  },
});
