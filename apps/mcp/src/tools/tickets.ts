import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CompactTicketDetail } from "@issues/shared";
import { PRIORITIES, projectKeySchema, SEARCH_SORT_COLUMNS, SEARCH_SORT_DIRECTIONS, ticketRefSchema } from "../constants.js";
import { IssuesApiError, type IssuesClient } from "../client.js";
import { markdownResult, safely } from "./respond.js";

const labelName = z.string().min(1).max(80);
const statusSlug = z.string().min(1).max(80);
const assigneeName = z.string().min(1).max(100);
const priorityEnum = z.enum(PRIORITIES);
const sortColumn = z.enum(SEARCH_SORT_COLUMNS);
const sortDirection = z.enum(SEARCH_SORT_DIRECTIONS);

const searchSchema = z.object({
  q: z.string().min(1).max(200).optional().describe("Full-text query against title and description."),
  project: projectKeySchema.optional().describe("Project key to scope the search to, e.g. 'DASH'."),
  status: z.array(statusSlug).optional().describe("Status slugs to filter by (e.g. ['in-progress'])."),
  priority: z.array(priorityEnum).optional().describe("Priority levels to filter by."),
  label: z.array(labelName).optional().describe("Label names to filter by."),
  assignee: z.array(assigneeName).optional().describe("Assignee names to filter by."),
  page: z.number().int().min(1).optional().describe("Page number (1-based). Defaults to 1."),
  perPage: z.number().int().min(1).max(50).optional().describe("Page size. Default 25, max 50. Response includes total + hasNextPage."),
  sortBy: sortColumn.optional().describe("Sort column. Defaults to 'relevance' when q is set, else 'updatedAt'."),
  sortDirection: sortDirection.optional().describe("Sort direction. Defaults to 'desc' (or 'asc' when sortBy = 'title')."),
});

const getSchema = z.object({
  ref: ticketRefSchema.describe("Ticket ref, e.g. 'DASH-12'."),
  full: z.boolean().optional().describe("If true, return the full description instead of the 200-char excerpt. Response carries `descriptionTruncated` either way."),
});

const createSchema = z.object({
  project: projectKeySchema.describe("Project key the ticket belongs to."),
  title: z.string().min(1).max(200).describe("Ticket title."),
  description: z.string().max(50_000).optional().describe("Markdown body."),
  statusSlug: statusSlug.optional().describe("Status slug. Defaults to the project's first status."),
  priority: priorityEnum.optional().describe("Priority. Defaults to 'medium'."),
  labels: z.array(labelName).optional().describe("Label names to attach."),
  assignee: assigneeName.nullable().optional().describe("Assignee name. Pass null to leave unassigned."),
  parentTicketRef: ticketRefSchema.nullable().optional().describe("Parent ticket ref in the same project (e.g. 'DASH-12'). Creates the new ticket as a subticket of the parent. Cross-project parents are rejected."),
});

const updateSchema = z.object({
  ref: ticketRefSchema.describe("Ticket ref to patch."),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(50_000).optional(),
  statusSlug: statusSlug.optional(),
  priority: priorityEnum.optional(),
  labels: z.array(labelName).optional().describe("Replaces the full set of labels. Cannot combine with addLabels/removeLabels."),
  addLabels: z.array(labelName).optional().describe("Adds these labels without touching existing ones."),
  removeLabels: z.array(labelName).optional().describe("Removes these labels if present."),
  assignee: assigneeName.nullable().optional().describe("Assignee name, or null to clear."),
  parentTicketRef: ticketRefSchema.nullable().optional().describe("Parent ticket ref in the same project, or null to clear the parent. Cycles (setting a descendant as a parent) are rejected with 400."),
});

const deleteSchema = z.object({
  ref: ticketRefSchema.describe("Ticket ref to soft-delete. Can be restored with restore_ticket."),
});

const restoreSchema = z.object({
  ref: ticketRefSchema.describe("Ref of a ticket currently in the trash."),
});

const cloneSchema = z.object({
  ref: ticketRefSchema.describe("Source ticket ref to clone from."),
  title: z.string().min(1).max(200).describe("Title for the new clone."),
  description: z.string().max(50_000).optional().describe("Override description. Defaults to the source's."),
  statusSlug: statusSlug.optional().describe("Override status slug. Defaults to the source's."),
  priority: priorityEnum.optional().describe("Override priority. Defaults to the source's."),
  labels: z.array(labelName).optional().describe("Override labels. Defaults to the source's."),
  assignee: assigneeName.nullable().optional().describe("Override assignee. Pass null to leave unassigned."),
  copyAttachments: z.boolean().optional().describe("If true, duplicate attachment rows. Default false."),
});

export type SearchArgs = z.infer<typeof searchSchema>;
export type GetArgs = z.infer<typeof getSchema>;
export type CreateArgs = z.infer<typeof createSchema>;
export type UpdateArgs = z.infer<typeof updateSchema>;
export type DeleteArgs = z.infer<typeof deleteSchema>;
export type RestoreArgs = z.infer<typeof restoreSchema>;
export type CloneArgs = z.infer<typeof cloneSchema>;

function renderTicketDetail(detail: CompactTicketDetail): string {
  const headerParts = [`Status: ${detail.status}`, `Priority: ${detail.priority}`, `Created: ${detail.created}`, `Updated: ${detail.updated}`];
  const labels = detail.labels.length ? `Labels: ${detail.labels.join(", ")}` : "Labels: (none)";
  const assignee = detail.assignee ?? "(unassigned)";
  const bodyLines = detail.description ? [detail.description] : ["(no description)"];
  if (detail.descriptionTruncated) bodyLines.push("", "_Description truncated — call get_ticket with full: true for the full body._");
  return [`# ${detail.ref}  ${detail.title}`, "", headerParts.join("  |  "), labels, `Reporter: ${detail.reporter}  |  Assignee: ${assignee}`, "", "---", "", ...bodyLines].join("\n");
}

export function handleSearchTickets(client: IssuesClient, args: SearchArgs) {
  return safely(() => client.searchTickets(args));
}

export async function handleGetTicket(client: IssuesClient, args: GetArgs) {
  try {
    const data = await client.getTicket(args.ref, { full: args.full });
    return markdownResult(renderTicketDetail(data.ticket));
  } catch (err) {
    const message = err instanceof IssuesApiError ? `Issues API ${err.status}: ${err.message}` : err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: message }], isError: true };
  }
}

export function handleCreateTicket(client: IssuesClient, args: CreateArgs) {
  return safely(() => client.createTicket(args));
}

export function handleUpdateTicket(client: IssuesClient, args: UpdateArgs) {
  const { ref, ...patch } = args;
  return safely(() => client.patchTicket(ref, patch));
}

export function handleDeleteTicket(client: IssuesClient, args: DeleteArgs) {
  return safely(() => client.softDeleteTicket(args.ref));
}

export function handleRestoreTicket(client: IssuesClient, args: RestoreArgs) {
  return safely(() => client.restoreTicket(args.ref));
}

export function handleCloneTicket(client: IssuesClient, args: CloneArgs) {
  const { ref, ...rest } = args;
  return safely(() => client.cloneTicket(ref, rest));
}

/** Registers every ticket-related MCP tool on the server. */
export function registerTicketTools(server: McpServer, client: IssuesClient) {
  server.registerTool(
    "search_tickets",
    {
      description: "Search tickets visible to the user. Supports optional full-text query, filters (project, status, priority, label, assignee), and sorting by relevance / updatedAt / createdAt / title. Returns compact summaries (max 50).",
      inputSchema: searchSchema.shape,
    },
    (args) => handleSearchTickets(client, args)
  );

  server.registerTool(
    "get_ticket",
    {
      description: "Fetch one ticket by its ref (e.g. 'DASH-12'). Description is excerpted to 200 chars. Comments and links are not included; use list_comments / list_links for those.",
      inputSchema: getSchema.shape,
    },
    (args) => handleGetTicket(client, args)
  );

  server.registerTool(
    "create_ticket",
    {
      description: "Create a new ticket. Provide project key + title; description, priority, labels, assignee, and parentTicketRef are optional. Pass parentTicketRef to create the ticket as a subticket of an existing ticket in the same project.",
      inputSchema: createSchema.shape,
    },
    (args) => handleCreateTicket(client, args)
  );

  server.registerTool(
    "update_ticket",
    {
      description: "Patch any subset of editable fields on an existing ticket. Pass assignee: null to clear the assignee, parentTicketRef: null to clear the parent.",
      inputSchema: updateSchema.shape,
    },
    (args) => handleUpdateTicket(client, args)
  );

  server.registerTool(
    "delete_ticket",
    {
      description: "Soft-delete a ticket. The row stays in the trash and can be brought back with restore_ticket.",
      inputSchema: deleteSchema.shape,
    },
    (args) => handleDeleteTicket(client, args)
  );

  server.registerTool(
    "restore_ticket",
    {
      description: "Restore a soft-deleted ticket from the trash.",
      inputSchema: restoreSchema.shape,
    },
    (args) => handleRestoreTicket(client, args)
  );

  server.registerTool(
    "clone_ticket",
    {
      description: "Clone a ticket. The new ticket lives in the same project. Any field omitted defaults to the source ticket's value. Attachments are skipped unless copyAttachments is true.",
      inputSchema: cloneSchema.shape,
    },
    (args) => handleCloneTicket(client, args)
  );
}

export const __testing = { renderTicketDetail };
