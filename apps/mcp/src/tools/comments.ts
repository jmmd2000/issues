import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ticketRefSchema } from "../constants.js";
import type { IssuesClient } from "../client.js";
import { safely } from "./respond.js";

const commentID = z.string().uuid();

const addInput = {
  ref: ticketRefSchema.describe("Ticket ref to comment on."),
  body: z.string().min(1).max(10_000).describe("Markdown comment body."),
} as const;

const listInput = {
  ref: ticketRefSchema.describe("Ticket ref."),
} as const;

const updateInput = {
  id: commentID.describe("Comment id returned by add_comment / list_comments."),
  body: z.string().min(1).max(10_000).describe("Replacement markdown body."),
} as const;

const deleteInput = {
  id: commentID.describe("Comment id to soft-delete."),
} as const;

export function handleAddComment(client: IssuesClient, args: { ref: string; body: string }) {
  return safely(() => client.addComment(args.ref, args.body));
}

export function handleListComments(client: IssuesClient, args: { ref: string }) {
  return safely(() => client.listComments(args.ref));
}

export function handleUpdateComment(client: IssuesClient, args: { id: string; body: string }) {
  return safely(() => client.updateComment(args.id, args.body));
}

export function handleDeleteComment(client: IssuesClient, args: { id: string }) {
  return safely(async () => {
    await client.deleteComment(args.id);
    return { deleted: true } as const;
  });
}

/** Registers comment tools on the MCP server. */
export function registerCommentTools(server: McpServer, client: IssuesClient) {
  server.registerTool(
    "add_comment",
    {
      description: "Add a markdown comment to a ticket. Returns the new comment id.",
      inputSchema: addInput,
    },
    (args) => handleAddComment(client, args)
  );

  server.registerTool(
    "list_comments",
    {
      description: "List every non-deleted comment on a ticket in chronological order.",
      inputSchema: listInput,
    },
    (args) => handleListComments(client, args)
  );

  server.registerTool(
    "update_comment",
    {
      description: "Edit a comment's body. Only the comment's author can edit. Pass the comment id from add_comment or list_comments.",
      inputSchema: updateInput,
    },
    (args) => handleUpdateComment(client, args)
  );

  server.registerTool(
    "delete_comment",
    {
      description: "Soft-delete a comment. Only the comment's author can delete. The thread keeps its shape; the deleted body is hidden.",
      inputSchema: deleteInput,
    },
    (args) => handleDeleteComment(client, args)
  );
}
