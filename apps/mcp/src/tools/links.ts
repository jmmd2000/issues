import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IssuesClient } from "../client.js";
import { LINK_TYPES, ticketRefSchema } from "../constants.js";
import { safely } from "./respond.js";

const linkType = z.enum(LINK_TYPES);

const listSchema = z.object({
  ref: ticketRefSchema.describe("Ticket ref to list links for."),
});

const mutateSchema = z.object({
  ref: ticketRefSchema.describe("The ticket the link starts from (source side)."),
  target: ticketRefSchema.describe("The other ticket (target side). Must live in any project the user can see."),
  linkType: linkType.describe("Link relationship — one of: blocks, depends_on, duplicates, relates_to, clones."),
});

export type ListLinksArgs = z.infer<typeof listSchema>;
export type LinkMutateArgs = z.infer<typeof mutateSchema>;

export function handleListLinks(client: IssuesClient, args: ListLinksArgs) {
  return safely(() => client.listLinks(args.ref));
}

export function handleAddLink(client: IssuesClient, args: LinkMutateArgs) {
  const { ref, ...rest } = args;
  return safely(() => client.addLink(ref, rest));
}

export function handleRemoveLink(client: IssuesClient, args: LinkMutateArgs) {
  const { ref, ...rest } = args;
  return safely(async () => {
    await client.removeLink(ref, rest);
    return { removed: true } as const;
  });
}

/** Registers the link tools on the MCP server. */
export function registerLinkTools(server: McpServer, client: IssuesClient) {
  server.registerTool(
    "list_links",
    {
      description: "List every link involving a ticket — outgoing and incoming combined. Each entry shows the partner ref, title, status, link type, and direction.",
      inputSchema: listSchema.shape,
    },
    (args) => handleListLinks(client, args)
  );

  server.registerTool(
    "add_link",
    {
      description: "Add a link from one ticket to another. The first ref is the source; the link type describes how it relates to the target (blocks / depends_on / duplicates / relates_to / clones).",
      inputSchema: mutateSchema.shape,
    },
    (args) => handleAddLink(client, args)
  );

  server.registerTool(
    "remove_link",
    {
      description: "Remove a link between two tickets. Only the canonical (source -> target) direction is matched; to remove an incoming link, call this from the other side.",
      inputSchema: mutateSchema.shape,
    },
    (args) => handleRemoveLink(client, args)
  );
}
