import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { validationHook } from "../lib/validation";
import { requireAuth } from "../middleware/auth";
import { TokenService, TOKEN_EXPIRY_DEFAULT_DAYS, TOKEN_EXPIRY_MAX_DAYS, TOKEN_EXPIRY_MIN_DAYS } from "../services/tokenService";

const createSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    expiresInDays: z.coerce.number().int().min(TOKEN_EXPIRY_MIN_DAYS).max(TOKEN_EXPIRY_MAX_DAYS).optional().default(TOKEN_EXPIRY_DEFAULT_DAYS),
  })
  .strict();

const idParamSchema = z.object({
  id: z.uuid(),
});

export const tokens = new Hono()
  .post("/api/auth/tokens", requireAuth, zValidator("json", createSchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const { name, expiresInDays } = c.req.valid("json");
    const result = await TokenService.createToken(userID, name, expiresInDays);
    return c.json(result, 201);
  })
  .get("/api/auth/tokens", requireAuth, async (c) => {
    const userID = c.get("userID");
    const apiTokens = await TokenService.listTokens(userID);
    return c.json({ apiTokens });
  })
  .delete("/api/auth/tokens/:id", requireAuth, zValidator("param", idParamSchema, validationHook), async (c) => {
    const userID = c.get("userID");
    const { id } = c.req.valid("param");
    await TokenService.revokeToken(userID, id);
    return c.body(null, 204);
  });
