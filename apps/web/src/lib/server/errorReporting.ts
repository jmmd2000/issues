import * as Sentry from "@sentry/node";
import type { ErrorReportingConfig } from "../errorReportingConfig";

/**
 * Builds the SDK options for the web server. Only the integrations listed here run, so the
 * SDK never collects request data such as cookies, headers or query strings by itself.
 * The default integrations would collect it, so they stay off. beforeSend drops any that arrives anyway.
 * @param config Where to send events and what to label them with
 * @returns The options to pass to `Sentry.init`
 */
export function buildServerErrorReportingOptions({ dsn, environment, release }: ErrorReportingConfig): Sentry.NodeOptions {
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

/**
 * Starts error reporting on the web server.
 * @param config The settings, or `undefined` to leave reporting off
 */
export function startServerErrorReporting(config: ErrorReportingConfig | undefined): void {
  if (!config) return;
  Sentry.init(buildServerErrorReportingOptions(config));
}

/**
 * Sends an error to GlitchTip. Does nothing when reporting is off.
 * @param error The error to send
 * @param tags Values to search by in GlitchTip, such as the HTTP method and path
 */
export function reportServerError(error: unknown, tags: Record<string, string> = {}): void {
  Sentry.captureException(error, { tags });
}
