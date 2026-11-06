import type { Handle, HandleFetch, HandleServerError, ServerInit } from "@sveltejs/kit";
import { env } from "$env/dynamic/public";
import { PUBLIC_API_URL } from "$env/static/public";
import { parseErrorReportingConfig } from "$lib/errorReportingConfig";
import { addSources } from "$lib/server/contentSecurityPolicy";
import { reportServerError, startServerErrorReporting } from "$lib/server/errorReporting";

export const init: ServerInit = () => {
  startServerErrorReporting(parseErrorReportingConfig(env));
};

/**
 * Adds the origins only known when the server runs to the page's
 * Content-Security-Policy: the API, which is on another port in dev, and the
 * GlitchTip host the browser sends errors to. A fetch during server rendering
 * also runs this hook when the API shares the app's origin, as in production.
 * That response is the API's, not a page, so the hook leaves it alone.
 */
export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  if (event.isSubRequest) return response;

  const policy = response.headers.get("content-security-policy");
  if (!policy) return response;

  const apiOrigin = new URL(PUBLIC_API_URL).origin;
  const errorReportingDSN = parseErrorReportingConfig(env)?.dsn;
  const connectSources = errorReportingDSN ? [apiOrigin, new URL(errorReportingDSN).origin] : [apiOrigin];

  const withConnectSources = addSources(policy, "connect-src", connectSources);
  response.headers.set("content-security-policy", addSources(withConnectSources, "img-src", [apiOrigin]));
  return response;
};

/**
 * Reads each response body as soon as it arrives during server rendering. SvelteKit sends a
 * fetch with no matching route to the network, wraps the body in a new Response and drops the
 * original. Node cancels a fetch body when its Response is garbage collected, so a body that
 * waits for other parallel fetches can fail with "Body is unusable".
 */
export const handleFetch: HandleFetch = async ({ request, fetch }) => {
  const response = await fetch(request);
  if (!response.body) return response;

  const body = await response.arrayBuffer();
  return new Response(body, response);
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
