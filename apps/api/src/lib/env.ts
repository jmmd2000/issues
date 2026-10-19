import "dotenv/config";
import { z } from "zod";

/** Reads a positive integer from the environment. An empty string counts as unset. */
function positiveInteger(defaultValue: number) {
  return z.preprocess(value => (value === "" ? undefined : value), z.coerce.number().int().positive().default(defaultValue));
}

/** An empty string counts as unset, so a blank line in .env turns an option off. */
const blankToUndefined = (value: unknown) => (value === "" ? undefined : value);

/** A DSN is a URL with a key as its user name and a project number as its path, such as https://key@host/1. */
const dsnSchema = z.string().refine(value => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return url.username !== "" && /^\/\d+$/.test(url.pathname);
}, "must be a DSN, such as https://<key>@<host>/<project id>");

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    DATABASE_URL: z.url(),
    PORT: positiveInteger(4000),
    WEB_ORIGIN: z.url().default("http://localhost:5173"),
    UPLOADS_DIR: z.string().min(1).default("./data/uploads"),
    MAX_IMAGE_BYTES: positiveInteger(10_000_000),
    MAX_FILE_BYTES: positiveInteger(10_000_000),
    MAX_IMAGE_OUTPUT_BYTES: positiveInteger(1_000_000),
    MAX_UPLOADS_BYTES: positiveInteger(20_000_000_000),
    // Error reporting is off without a DSN. The environment names where events come from, such as production.
    GLITCHTIP_DSN: z.preprocess(blankToUndefined, dsnSchema.optional()),
    GLITCHTIP_ENVIRONMENT: z.preprocess(blankToUndefined, z.string().optional()),
    // The commit the image was built from. The deploy sets it from the image tag.
    GIT_SHA: z.preprocess(blankToUndefined, z.string().default("dev")),
  })
  .refine(env => !env.GLITCHTIP_DSN || env.GLITCHTIP_ENVIRONMENT, {
    message: "is needed whenever GLITCHTIP_DSN is set, such as production",
    path: ["GLITCHTIP_ENVIRONMENT"],
  });

export type Env = z.infer<typeof envSchema>;

/** Thrown by {@link parseEnv} when a variable is missing or invalid. */
export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvError";
  }
}

/**
 * Validates an environment and fills in defaults.
 * @param source The variables to read, normally `process.env`
 * @throws EnvError listing every missing or invalid variable
 * @returns The parsed environment
 */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;

  const problems = result.error.issues.map(issue => `${issue.path.join(".") || "(env)"}: ${issue.message}`).join("\n  ");
  throw new EnvError(`Invalid environment. Check .env against .env.example.\n  ${problems}`);
}

/**
 * Reads and validates `process.env`. Prints the problems to stderr and exits
 * with code 1 when it is invalid, so a bad deploy stops at startup. Parses on
 * every call so tests can change `process.env` between cases.
 * @returns The parsed environment
 */
export function getEnv(): Env {
  try {
    return parseEnv(process.env);
  } catch (error) {
    if (!(error instanceof EnvError)) throw error;
    process.stderr.write(`@issues/api: ${error.message}\n`);
    process.exit(1);
  }
}
