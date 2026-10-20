import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env"), quiet: true });

const testEnvironmentSchema = z.object({
  DATABASE_URL_TEST: z.url(),
});

const parsedEnvironment = testEnvironmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  console.error("Invalid test environment variables:", z.flattenError(parsedEnvironment.error).fieldErrors);
  throw new Error("Invalid test environment variables. Check .env against .env.example.");
}

/** Environment variables for the API tests, validated once when this module loads. */
export const testEnvironment = parsedEnvironment.data;
