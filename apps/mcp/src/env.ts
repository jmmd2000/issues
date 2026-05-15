import { z } from "zod";

const envSchema = z.object({
  ISSUES_API_URL: z.string().url(),
  ISSUES_API_TOKEN: z.string().min(1),
});

/**
 * Reads and validates the environment variables required to run the MCP server.
 * Fails fast on stderr with a precise message so misconfiguration is visible
 * the moment the binary is launched by Claude Code.
 * @returns The parsed API URL and bearer token.
 */
export function loadEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((issue) => `${issue.path.join(".") || "(env)"}: ${issue.message}`).join("\n  ");
    process.stderr.write(`@issues/mcp: invalid environment.\n  ${missing}\n`);
    process.exit(1);
  }
  const url = result.data.ISSUES_API_URL.replace(/\/$/, "");
  return { apiURL: url, apiToken: result.data.ISSUES_API_TOKEN };
}
