import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IssuesClient } from "../client.js";
import { projectKeySchema, ticketRefSchema } from "../constants.js";
import { safely } from "./respond.js";

const projectActivitySchema = z.object({
  project: projectKeySchema.describe("Project key, e.g. 'DASH'."),
  limit: z.number().int().min(1).max(100).optional().describe("Maximum rows. Default 30, max 100."),
});

const ticketActivitySchema = z.object({
  ref: ticketRefSchema.describe("Ticket ref, e.g. 'DASH-12'."),
});

export type ProjectActivityArgs = z.infer<typeof projectActivitySchema>;
export type TicketActivityArgs = z.infer<typeof ticketActivitySchema>;

export function handleGetActivity(client: IssuesClient, args: ProjectActivityArgs) {
  return safely(() => client.getActivity(args.project, args.limit));
}

export function handleGetTicketActivity(client: IssuesClient, args: TicketActivityArgs) {
  return safely(() => client.getTicketActivity(args.ref));
}

/** Registers the activity tools on the MCP server. */
export function registerActivityTools(server: McpServer, client: IssuesClient) {
  server.registerTool(
    "get_activity",
    {
      description: "Fetch recent activity for one project. Each entry carries the ticket ref, the field that changed, and human-readable old/new values.",
      inputSchema: projectActivitySchema.shape,
    },
    (args) => handleGetActivity(client, args)
  );

  server.registerTool(
    "get_ticket_activity",
    {
      description: "Fetch the full activity log for one ticket: every field change, comment, link, and attachment event.",
      inputSchema: ticketActivitySchema.shape,
    },
    (args) => handleGetTicketActivity(client, args)
  );
}
