import { playwright } from "@vitest/browser-playwright";
import { defineConfig, mergeConfig } from "vitest/config";
import { loadViteConfig } from "./loadViteConfig.ts";

const viteConfig = await loadViteConfig();

export default mergeConfig(
  viteConfig,
  defineConfig({
    root: import.meta.dirname,
    test: {
      root: import.meta.dirname,
      dir: import.meta.dirname,
      name: "web-client",
      expect: { requireAssertions: true },
      browser: {
        enabled: true,
        provider: playwright(),
        instances: [{ browser: "chromium", headless: true }],
      },
      include: ["src/**/*.svelte.{test,spec}.{js,ts}"],
      exclude: ["src/lib/server/**"],
    },
  })
);
