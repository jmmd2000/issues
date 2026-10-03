import "dotenv/config";
import { z } from "zod";

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
