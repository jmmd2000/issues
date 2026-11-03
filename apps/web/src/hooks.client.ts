import type { ClientInit, HandleClientError } from "@sveltejs/kit";
import { env } from "$env/dynamic/public";
import "$lib/zodSettings";
import { parseErrorReportingConfig } from "$lib/errorReportingConfig";
import { reportBrowserError, startBrowserErrorReporting } from "$lib/errorReporting";

export const init: ClientInit = () => {
  startBrowserErrorReporting(parseErrorReportingConfig(env));
};

/**
 * Logs and reports errors the app did not expect. SvelteKit also calls this for a missing
 * page (404), which is not a fault, so only server errors (500 and above) are reported.
 */
export const handleError: HandleClientError = ({ error, event, status }) => {
  console.error("Unhandled error:", error, { path: event.url.pathname });
  if (status >= 500) reportBrowserError(error, { path: event.url.pathname });
};
