/**
 * Runtime constants needed by the MCP server. Mirrored from `@issues/shared`
 * because the shared package's entry is a `.ts` file that plain Node cannot
 * load. Type-only imports from `@issues/shared` are erased at compile time
 * and stay sourced from the workspace.
 *
 * Keep in lockstep with `packages/shared/src/index.ts` and
 * `packages/shared/src/mcp.ts`.
 */
import { z } from "zod";

export const PRIORITIES = ["critical", "high", "medium", "low", "none"] as const;
export const LINK_TYPES = ["blocks", "depends_on", "duplicates", "relates_to", "clones"] as const;
export const SEARCH_SORT_COLUMNS = ["relevance", "updatedAt", "createdAt", "title"] as const;
export const SEARCH_SORT_DIRECTIONS = ["asc", "desc"] as const;
export const TICKET_REF_REGEX = /^([A-Z]{2,6})-([1-9][0-9]*)$/;
export const PROJECT_KEY_REGEX = /^[A-Z]{2,6}$/;

export const projectKeySchema = z.string().regex(PROJECT_KEY_REGEX);
export const ticketRefSchema = z.string().regex(TICKET_REF_REGEX);
