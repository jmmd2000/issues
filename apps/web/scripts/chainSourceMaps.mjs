import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import remapping from "@jridgewell/remapping";

/**
 * Joins the source maps of the server build to the maps of the files they were made from.
 * The SvelteKit adapter bundles the server files again, and its maps only point back to the
 * files of the first build. Without this step GlitchTip would show those files and not the
 * original source. A map is changed only where the file it points to has a map of its own.
 * Usage: `node chainSourceMaps.mjs <folder with the final maps>`
 */
async function chainSourceMaps(folder) {
  const entries = await readdir(folder, { recursive: true });
  const mapPaths = entries.filter(entry => entry.endsWith(".js.map")).map(entry => join(folder, entry));

  for (const mapPath of mapPaths) {
    const map = JSON.parse(await readFile(mapPath, "utf8"));
    const chained = remapping(map, source => {
      const sourceMapPath = `${resolve(dirname(mapPath), source)}.map`;
      if (!existsSync(sourceMapPath)) return null;
      return JSON.parse(readFileSync(sourceMapPath, "utf8"));
    });
    await writeFile(mapPath, JSON.stringify(chained));
  }
  console.log(`Chained ${mapPaths.length} source maps in ${folder}`);
}

const folder = process.argv[2];
if (!folder) {
  console.error("Usage: node chainSourceMaps.mjs <folder>");
  process.exit(1);
}
await chainSourceMaps(folder);
