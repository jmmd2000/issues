import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { z } from "zod";

const require = createRequire(import.meta.url);

const packageManifestSchema = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
});

/**
 * Finds the version of an installed package. Some packages do not export their
 * `package.json`, so this starts at the package's entry file and walks up to
 * the folder that holds its manifest.
 * @param packageName The package name, such as `hono`
 * @returns The installed version, or `null` if it cannot be found
 */
export function getInstalledVersion(packageName: string): string | null {
  try {
    let directory = path.dirname(require.resolve(packageName));

    while (directory !== path.dirname(directory)) {
      const manifestPath = path.join(directory, "package.json");
      if (fs.existsSync(manifestPath)) {
        const manifest = packageManifestSchema.parse(JSON.parse(fs.readFileSync(manifestPath, "utf8")));
        if (manifest.name === packageName) return manifest.version ?? null;
      }
      directory = path.dirname(directory);
    }
    return null;
  } catch {
    return null;
  }
}
