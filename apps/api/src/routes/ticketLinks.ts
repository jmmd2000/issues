import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { LINK_TYPES } from "../lib/constants";
import { validationHook } from "../lib/validation";
import { requireAuth } from "../middleware/auth";
import { requireProjectAccess } from "../middleware/projectAccess";
import { TicketLinkService } from "../services/ticketLinkService";
import { TicketService } from "../services/ticketService";
import { projectKeyParamSchema } from "./projects";

const ticketParamSchema = projectKeyParamSchema.extend({
  num: z.coerce.number().int().positive(),
});

const linkParamSchema = ticketParamSchema.extend({
  id: z.uuid(),
});

// Manual links cannot be of type `clones` -- those are written exclusively by
// the clone action so they always describe a real ancestral relationship.
// The cast keeps the imported LINK_TYPES as the source of truth for the rest
// of the type (and trips at compile time if a real type is ever added).
const MANUAL_LINK_TYPES = ["blocks", "depends_on", "duplicates", "relates_to"] as const satisfies ReadonlyArray<Exclude<(typeof LINK_TYPES)[number], "clones">>;

const createLinkSchema = z
  .object({
    targetRef: z
      .string()
      .trim()
      .min(1)
      .transform((value) => value.toUpperCase()),
    linkType: z.enum(MANUAL_LINK_TYPES),
    direction: z.enum(["outgoing", "incoming"]).default("outgoing"),
  })
  .strict();

export const ticketLinks = new Hono()
  .get("/api/projects/:key/tickets/:num/links", requireAuth, zValidator("param", ticketParamSchema, validationHook), requireProjectAccess("member"), async (c) => {
    const project = c.get("project");
    const { num } = c.req.valid("param");

    const ticket = await TicketService.getTicketByNumber(project.id, num);
    const links = await TicketLinkService.listForTicket(ticket.id);
    return c.json({ links });
  })
  .post(
    "/api/projects/:key/tickets/:num/links",
    requireAuth,
    zValidator("json", createLinkSchema, validationHook),
    zValidator("param", ticketParamSchema, validationHook),
    requireProjectAccess("member"),
    async (c) => {
      const project = c.get("project");
      const userID = c.get("userID");
      const { num, key } = c.req.valid("param");
      const { targetRef, linkType, direction } = c.req.valid("json");

      const ticket = await TicketService.getTicketByNumber(project.id, num);
      const link = await TicketLinkService.createLink({
        viewingTicketID: ticket.id,
        viewingTicketRef: { number: ticket.number, title: ticket.title, projectKey: key },
        userID,
        targetRef,
        linkType,
        direction,
      });
      return c.json({ link }, 201);
    }
  )
  .delete("/api/projects/:key/tickets/:num/links/:id", requireAuth, zValidator("param", linkParamSchema, validationHook), requireProjectAccess("member"), async (c) => {
    const project = c.get("project");
    const userID = c.get("userID");
    const { num, id } = c.req.valid("param");

    const ticket = await TicketService.getTicketByNumber(project.id, num);
    await TicketLinkService.deleteLink(id, ticket.id, userID);
    return c.body(null, 204);
  });
