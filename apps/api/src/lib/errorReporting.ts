import * as Sentry from "@sentry/node";
import { getEnv } from "./env";

/**
 * Builds the SDK options. Only the integrations listed here run, so the SDK never collects
 * request data such as cookies, headers, bodies or query strings by itself. The default
 * integrations would collect it, so they stay off. beforeSend drops any that arrives anyway.
 * @param dsn Where GlitchTip takes events
 * @param environment Where the events come from, such as production
 * @param release The commit the running image was built from
 * @returns The options to pass to `Sentry.init`
 */
export function buildErrorReportingOptions(dsn: string, environment: string, release: string): Sentry.NodeOptions {
  return {
    dsn,
    environment,
    release,
    defaultIntegrations: false,
    integrations: [
      Sentry.linkedErrorsIntegration(),
      Sentry.onUncaughtExceptionIntegration(),
      // "strict" keeps Node's own behaviour: an unhandled rejection stops the process
      Sentry.onUnhandledRejectionIntegration({ mode: "strict" }),
    ],
    beforeSend: event => ({ ...event, request: undefined }),
  };
}

/** Starts error reporting. Does nothing unless GLITCHTIP_DSN is set. */
export function startErrorReporting(): void {
  const { GLITCHTIP_DSN: dsn, GLITCHTIP_ENVIRONMENT: environment, GIT_SHA: release } = getEnv();
  if (!dsn || !environment) return;
  Sentry.init(buildErrorReportingOptions(dsn, environment, release));
}

/**
 * Sends an error to GlitchTip. Does nothing when reporting is off.
 * @param error The error to send
 * @param tags Values to search by in GlitchTip, such as the HTTP method and path
 */
export function reportError(error: unknown, tags: Record<string, string> = {}): void {
  Sentry.captureException(error, { tags });
}
