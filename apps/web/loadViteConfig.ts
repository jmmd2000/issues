import type { UserConfig } from "vite";

/**
 * Loads the web app's Vite config. SvelteKit reads its own config from the
 * current folder, so the load runs with the web folder as the current folder
 * and then puts the old one back. This lets the root Vitest config run the web
 * projects from the repo root.
 */
export async function loadViteConfig(): Promise<UserConfig> {
  const originalFolder = process.cwd();
  process.chdir(import.meta.dirname);
  try {
    const module = await import("./vite.config.ts");
    return module.default;
  } finally {
    process.chdir(originalFolder);
  }
}
