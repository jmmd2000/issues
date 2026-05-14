import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { PRIORITIES, SEARCH_SORT_COLUMNS, SEARCH_SORT_DIRECTIONS } from "../lib/constants";
import { validationHook } from "../lib/validation";
import { optionalAuth } from "../middleware/auth";
import { SearchService } from "../services/searchService";

const projectKeyQuerySchema = z
  .string()
  .trim()
  .min(2)
  .max(6)
  .transform((value) => value.toUpperCase());

const listParam = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((value) => {
    if (value === undefined) return undefined;
    const values = Array.isArray(value) ? value : [value];
    return values.flatMap((entry) =>
      String(entry)
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    );
  }, z.array(item).optional());

const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  project: projectKeyQuerySchema.optional(),
  status: listParam(z.string().trim().min(1).max(80)),
  priority: listParam(z.enum(PRIORITIES)),
  label: listParam(z.string().trim().min(1).max(80)),
  assignee: listParam(z.uuid()),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(SEARCH_SORT_COLUMNS).optional(),
  sortDirection: z.enum(SEARCH_SORT_DIRECTIONS).optional(),
});

const filterOptionsQuerySchema = z.object({
  project: projectKeyQuerySchema.optional(),
});

export const search = new Hono()
  .get("/api/search/filters", optionalAuth, zValidator("query", filterOptionsQuerySchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const query = c.req.valid("query");
    const filters = await SearchService.listFilterOptions(userID, query.project);
    return c.json({ filters });
  })
  .get("/api/search", optionalAuth, zValidator("query", searchQuerySchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const query = c.req.valid("query");
    const result = await SearchService.search(
      {
        q: query.q,
        projectKey: query.project,
        statusSlugs: query.status,
        priorities: query.priority,
        labelNames: query.label,
        assigneeIDs: query.assignee,
        page: query.page,
        perPage: query.perPage,
        sortBy: query.sortBy,
        sortDirection: query.sortDirection,
      },
      userID
    );

    return c.json(result);
  });
