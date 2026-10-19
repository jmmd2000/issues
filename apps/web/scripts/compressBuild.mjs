import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { brotliCompress, constants, gzip } from "node:zlib";

const brotliCompressAsync = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

/**
 * Writes fresh `.gz` and `.br` copies next to every JavaScript file under a folder.
 * The SvelteKit adapter makes these copies during the build. The source map step then
 * changes the JavaScript files, so the old copies no longer match them. The server
 * sends the compressed copies to browsers, so they must match.
 * Usage: `node compressBuild.mjs <folder>`
 */
async function compressScripts(folder) {
  const entries = await readdir(folder, { recursive: true });
  const scriptPaths = entries.filter(entry => entry.endsWith(".js")).map(entry => join(folder, entry));

  for (const scriptPath of scriptPaths) {
    const content = await readFile(scriptPath);
    const brotliOptions = { params: { [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY } };
    await writeFile(`${scriptPath}.gz`, await gzipAsync(content, { level: constants.Z_BEST_COMPRESSION }));
    await writeFile(`${scriptPath}.br`, await brotliCompressAsync(content, brotliOptions));
  }
  console.log(`Compressed ${scriptPaths.length} scripts in ${folder}`);
}

const folder = process.argv[2];
if (!folder) {
  console.error("Usage: node compressBuild.mjs <folder>");
  process.exit(1);
}
await compressScripts(folder);
