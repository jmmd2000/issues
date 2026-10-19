import { z } from "zod";

/** The settings the web app needs to send errors to GlitchTip. */
export interface ErrorReportingConfig {
  dsn: string;
  environment: string;
  release: string;
}

/** An empty string counts as unset, so a blank line in .env turns an option off. */
const blankToUndefined = (value: unknown) => (value === "" ? undefined : value);

/** A DSN is a URL with a key as its user name and a project number as its path, such as https://key@host/1. */
const dsnSchema = z.string().refine(value => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return url.username !== "" && /^\/\d+$/.test(url.pathname);
}, "must be a DSN, such as https://<key>@<host>/<project id>");

const configSchema = z
  .object({
    PUBLIC_GLITCHTIP_DSN: z.preprocess(blankToUndefined, dsnSchema.optional()),
    PUBLIC_GLITCHTIP_ENVIRONMENT: z.preprocess(blankToUndefined, z.string().optional()),
    PUBLIC_GIT_SHA: z.preprocess(blankToUndefined, z.string().default("dev")),
  })
  .refine(env => !env.PUBLIC_GLITCHTIP_DSN || env.PUBLIC_GLITCHTIP_ENVIRONMENT, {
    message: "is needed whenever PUBLIC_GLITCHTIP_DSN is set, such as production",
    path: ["PUBLIC_GLITCHTIP_ENVIRONMENT"],
  });

/**
 * Reads the error reporting settings from the public environment.
 * @param source The variables to read, such as `$env/dynamic/public`
 * @throws Error listing every invalid variable
 * @returns The settings, or `undefined` when no DSN is set and reporting is off
 */
export function parseErrorReportingConfig(source: Record<string, string | undefined>): ErrorReportingConfig | undefined {
  const result = configSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("\n  ");
    throw new Error(`Invalid error reporting settings.\n  ${problems}`);
  }

  const { PUBLIC_GLITCHTIP_DSN: dsn, PUBLIC_GLITCHTIP_ENVIRONMENT: environment, PUBLIC_GIT_SHA: release } = result.data;
  if (!dsn || !environment) return undefined;
  return { dsn, environment, release };
}
