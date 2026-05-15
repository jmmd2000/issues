import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ticketRefSchema } from "../constants.js";
import type { IssuesClient } from "../client.js";
import { safely } from "./respond.js";

const listSchema = z.object({
  ref: ticketRefSchema.describe("Ticket ref to list attachments for."),
});

export type ListAttachmentsArgs = z.infer<typeof listSchema>;

export function handleListAttachments(client: IssuesClient, args: ListAttachmentsArgs) {
  return safely(() => client.listAttachments(args.ref));
}

/** Registers attachment tools on the MCP server (read-only for now). */
export function registerAttachmentTools(server: McpServer, client: IssuesClient) {
  server.registerTool(
    "list_attachments",
    {
      description: "List every attachment on a ticket. Each entry has filename, size, MIME type, uploader name, and a URL relative to the API origin.",
      inputSchema: listSchema.shape,
    },
    (args) => handleListAttachments(client, args)
  );
}
