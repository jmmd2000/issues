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
      name: "web-server",
      expect: { requireAssertions: true },
      environment: "node",
      include: ["src/**/*.{test,spec}.{js,ts}"],
      exclude: ["src/**/*.svelte.{test,spec}.{js,ts}"],
    },
  })
);
