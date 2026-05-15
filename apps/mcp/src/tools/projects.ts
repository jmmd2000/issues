import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IssuesClient } from "../client.js";
import { projectKeySchema } from "../constants.js";
import { safely } from "./respond.js";

const keySchema = z.object({ key: projectKeySchema.describe("Project key, e.g. 'DASH'.") });
export type KeyArgs = z.infer<typeof keySchema>;

export function handleListProjects(client: IssuesClient) {
  return safely(() => client.listProjects());
}

export function handleGetProject(client: IssuesClient, args: KeyArgs) {
  return safely(() => client.getProject(args.key));
}

export function handleListMembers(client: IssuesClient, args: KeyArgs) {
  return safely(() => client.listMembers(args.key));
}

export function handleListStatuses(client: IssuesClient, args: KeyArgs) {
  return safely(() => client.listStatuses(args.key));
}

export function handleListLabels(client: IssuesClient, args: KeyArgs) {
  return safely(() => client.listLabels(args.key));
}

export function handleGetStats(client: IssuesClient, args: KeyArgs) {
  return safely(() => client.getStats(args.key));
}

/** Registers every project-scoped MCP tool. */
export function registerProjectTools(server: McpServer, client: IssuesClient) {
  server.registerTool(
    "list_projects",
    {
      description: "List every project the authenticated user is a member of, returned as { key, name } pairs.",
    },
    () => handleListProjects(client)
  );

  server.registerTool(
    "get_project",
    {
      description: "Fetch one project with its members, statuses, and labels. Call this before mutations to learn the valid status slugs and label names — beats trial-and-error 400 responses.",
      inputSchema: keySchema.shape,
    },
    (args) => handleGetProject(client, args)
  );

  server.registerTool(
    "list_members",
    {
      description: "List the members of a project: name + email + role. Use when you only need the assignee pool.",
      inputSchema: keySchema.shape,
    },
    (args) => handleListMembers(client, args)
  );

  server.registerTool(
    "list_statuses",
    {
      description: "List the statuses of a project in display order. Each entry has a name (display), slug (for API calls), and category.",
      inputSchema: keySchema.shape,
    },
    (args) => handleListStatuses(client, args)
  );

  server.registerTool(
    "list_labels",
    {
      description: "List the labels available on a project, alphabetised. Each entry has a name + hex colour.",
      inputSchema: keySchema.shape,
    },
    (args) => handleListLabels(client, args)
  );

  server.registerTool(
    "get_stats",
    {
      description: "Get ticket counts for a project: total / open / closed / last activity + a per-member breakdown keyed by user name.",
      inputSchema: keySchema.shape,
    },
    (args) => handleGetStats(client, args)
  );
}
