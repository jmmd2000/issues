import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IssuesClient } from "../client.js";
import { registerActivityTools } from "./activity.js";
import { registerAttachmentTools } from "./attachments.js";
import { registerCommentTools } from "./comments.js";
import { registerLinkTools } from "./links.js";
import { registerProjectTools } from "./projects.js";
import { registerTicketTools } from "./tickets.js";

/**
 * Registers every MCP tool exposed by `@issues/mcp`. New tools must be added
 * here so the stdio server picks them up on startup.
 */
export function registerAllTools(server: McpServer, client: IssuesClient) {
  registerProjectTools(server, client);
  registerTicketTools(server, client);
  registerCommentTools(server, client);
  registerLinkTools(server, client);
  registerAttachmentTools(server, client);
  registerActivityTools(server, client);
}
