import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";

const require = createRequire(import.meta.url);

/** Reads the installed version of a package, so the build info shows what the app is built with. */
function readPackageVersion(packageName: string): string {
  const manifest: { version: string } = require(`${packageName}/package.json`);
  return manifest.version;
}

const rootManifest: { version: string } = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));

const webPackages = ["svelte", "@sveltejs/kit", "vite"].map(name => ({ name, version: readPackageVersion(name) }));

export default defineConfig({
  plugins: [sveltekit()],
  // The Docker build sets GIT_SHA and BUILT_AT. A local run has neither, so the commit shows as dev.
  define: {
    __SITE_VERSION__: JSON.stringify(rootManifest.version),
    __GIT_SHA__: JSON.stringify(process.env.GIT_SHA || "dev"),
    __BUILT_AT__: JSON.stringify(process.env.BUILT_AT || null),
    __WEB_PACKAGES__: JSON.stringify(webPackages),
  },
  build: {
    // "hidden" writes the maps without linking them from the bundles. The Docker build uploads them, then deletes them.
    sourcemap: "hidden",
  },
});
