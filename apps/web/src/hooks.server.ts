import type { HandleServerError, ServerInit } from "@sveltejs/kit";
import { env } from "$env/dynamic/public";
import { parseErrorReportingConfig } from "$lib/errorReportingConfig";
import { reportServerError, startServerErrorReporting } from "$lib/server/errorReporting";

export const init: ServerInit = () => {
  startServerErrorReporting(parseErrorReportingConfig(env));
};

/**
 * Logs and reports errors the app did not expect. SvelteKit also calls this for a missing
 * page (404), which is not a fault, so only server errors (500 and above) are reported.
 */
export const handleError: HandleServerError = ({ error, event, status }) => {
  const request = { path: event.url.pathname, method: event.request.method };
  console.error("Unhandled error:", error, request);
  if (status >= 500) reportServerError(error, request);
};
