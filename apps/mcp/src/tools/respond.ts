import { IssuesApiError } from "../client.js";

type TextContent = { type: "text"; text: string };
type ToolResult = { content: TextContent[]; isError?: boolean };

/**
 * Default success format for list/search tools: a JSON-serialised payload.
 * Smallest token footprint per response while staying machine-parseable.
 */
export function jsonResult<T>(data: T): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

/**
 * Wraps a tool handler so any error becomes an `isError` MCP response with the
 * API's message preserved. The model sees the message and can correct its
 * next call (e.g. "Unknown status slug: nope" -> retry with a real slug).
 */
export async function safely<T>(fn: () => Promise<T>): Promise<ToolResult> {
  try {
    const data = await fn();
    return jsonResult(data);
  } catch (err) {
    const message = err instanceof IssuesApiError ? `Issues API ${err.status}: ${err.message}` : err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text", text: message }], isError: true };
  }
}

/**
 * Renders a tool result as markdown rather than JSON. Used by tools whose
 * output is prose-heavy (e.g. ticket detail) so the model can ingest it
 * efficiently.
 */
export function markdownResult(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}
