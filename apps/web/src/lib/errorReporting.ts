import * as Sentry from "@sentry/svelte";
import type { ErrorReportingConfig } from "./errorReportingConfig";

const MAX_BREADCRUMBS = 20;
const BREADCRUMB_URL_KEYS = ["url", "from", "to"];

/** Cuts the query string and fragment off a URL, because they can hold search terms or tokens. */
function withoutQueryOrHash(url: string): string {
  return url.split(/[?#]/)[0];
}

/**
 * Keeps only the page address (without query or fragment) and the User-Agent of a request.
 * GlitchTip reads the browser and operating system from the User-Agent. Cookies, referrer
 * and other headers are dropped.
 * @param request The request the SDK collected
 * @returns The reduced request, or `undefined` when there is no address
 */
export function reduceRequest(request: Sentry.Event["request"]): Sentry.Event["request"] {
  if (!request?.url) return undefined;
  const userAgent = request.headers?.["User-Agent"];
  return {
    url: withoutQueryOrHash(request.url),
    headers: userAgent ? { "User-Agent": userAgent } : undefined,
  };
}

/**
 * Drops typing breadcrumbs and cuts query strings off the addresses in the others.
 * @param breadcrumb A breadcrumb the SDK recorded
 * @returns The cleaned breadcrumb, or `null` to drop it
 */
export function cleanBreadcrumb(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb | null {
  if (breadcrumb.category === "ui.input") return null;
  if (!breadcrumb.data) return breadcrumb;

  const data = { ...breadcrumb.data };
  for (const key of BREADCRUMB_URL_KEYS) {
    const value = data[key];
    if (typeof value === "string") data[key] = withoutQueryOrHash(value);
  }
  return { ...breadcrumb, data };
}

/**
 * Builds the SDK options for the browser. Only the integrations listed here run, so the SDK
 * never collects form values, request bodies or console output by itself.
 * @param config Where to send events and what to label them with
 * @returns The options to pass to `Sentry.init`
 */
export function buildBrowserErrorReportingOptions({ dsn, environment, release }: ErrorReportingConfig): Sentry.BrowserOptions {
  return {
    dsn,
    environment,
    release,
    defaultIntegrations: false,
    integrations: [Sentry.linkedErrorsIntegration(), Sentry.globalHandlersIntegration(), Sentry.httpContextIntegration(), Sentry.breadcrumbsIntegration({ sentry: false })],
    maxBreadcrumbs: MAX_BREADCRUMBS,
    beforeBreadcrumb: cleanBreadcrumb,
    beforeSend: event => ({ ...event, request: reduceRequest(event.request) }),
  };
}

/**
 * Starts error reporting in the browser.
 * @param config The settings, or `undefined` to leave reporting off
 */
export function startBrowserErrorReporting(config: ErrorReportingConfig | undefined): void {
  if (!config) return;
  Sentry.init(buildBrowserErrorReportingOptions(config));
}

/**
 * Sends an error to GlitchTip. Does nothing when reporting is off.
 * @param error The error to send
 * @param tags Values to search by in GlitchTip, such as the page path
 */
export function reportBrowserError(error: unknown, tags: Record<string, string> = {}): void {
  Sentry.captureException(error, { tags });
}
