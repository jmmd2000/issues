import { createRequire } from "node:module";
import { z } from "zod";

const packageSchema = z.object({ version: z.string() });

/** The version in this package's package.json, so the server never reports a stale one. */
export const packageVersion = packageSchema.parse(createRequire(import.meta.url)("../package.json")).version;
