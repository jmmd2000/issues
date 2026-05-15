import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { apiTokens, users } from "../db/schema";
import { validationHook } from "../lib/validation";
import { requireAuth } from "../middleware/auth";
import { AuthService } from "../services/authService";
import { TokenService, TOKEN_EXPIRY_DEFAULT_DAYS, TOKEN_EXPIRY_MAX_DAYS, TOKEN_EXPIRY_MIN_DAYS } from "../services/tokenService";

const createUserSchema = z.object({ name: z.string().trim().min(1).max(80) }).strict();

const createTokenSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    expiresInDays: z.coerce.number().int().min(TOKEN_EXPIRY_MIN_DAYS).max(TOKEN_EXPIRY_MAX_DAYS).optional().default(TOKEN_EXPIRY_DEFAULT_DAYS),
  })
  .strict();

const userIdParam = z.object({ id: z.uuid() });
const userAndTokenIdParam = z.object({ id: z.uuid(), tokenID: z.uuid() });

const requireHuman = async (userID: string) => {
  if (!(await AuthService.isHuman(userID))) {
    throw new HTTPException(403, { message: "Only human users can manage service users." });
  }
};

const requireServiceUser = async (id: string) => {
  const [row] = await db.select({ isService: users.isService }).from(users).where(eq(users.id, id)).limit(1);
  if (!row || !row.isService) throw new HTTPException(404, { message: "Service user not found." });
};

const serviceTokenColumns = {
  id: apiTokens.id,
  name: apiTokens.name,
  lastUsedAt: apiTokens.lastUsedAt,
  expiresAt: apiTokens.expiresAt,
  createdAt: apiTokens.createdAt,
} as const;

export const serviceUsers = new Hono()
  .get("/api/users/service", requireAuth, async (c) => {
    await requireHuman(c.get("userID"));
    const serviceUsersList = await AuthService.listServiceUsers();
    return c.json({ serviceUsers: serviceUsersList }, 200);
  })
  .post("/api/users/service", requireAuth, zValidator("json", createUserSchema, validationHook), async (c) => {
    await requireHuman(c.get("userID"));
    const { name } = c.req.valid("json");
    const user = await AuthService.createServiceUser(name);
    return c.json({ user }, 201);
  })
  .get("/api/users/service/:id/tokens", requireAuth, zValidator("param", userIdParam, validationHook), async (c) => {
    await requireHuman(c.get("userID"));
    const { id } = c.req.valid("param");
    await requireServiceUser(id);
    const list = await db.select(serviceTokenColumns).from(apiTokens).where(eq(apiTokens.userID, id)).orderBy(desc(apiTokens.createdAt));
    return c.json({ apiTokens: list }, 200);
  })
  .post("/api/users/service/:id/tokens", requireAuth, zValidator("param", userIdParam, validationHook), zValidator("json", createTokenSchema, validationHook), async (c) => {
    await requireHuman(c.get("userID"));
    const { id } = c.req.valid("param");
    await requireServiceUser(id);
    const { name, expiresInDays } = c.req.valid("json");
    const result = await TokenService.createToken(id, name, expiresInDays);
    return c.json(result, 201);
  })
  .delete("/api/users/service/:id/tokens/:tokenID", requireAuth, zValidator("param", userAndTokenIdParam, validationHook), async (c) => {
    await requireHuman(c.get("userID"));
    const { id, tokenID } = c.req.valid("param");
    await requireServiceUser(id);
    const deleted = await db
      .delete(apiTokens)
      .where(and(eq(apiTokens.id, tokenID), eq(apiTokens.userID, id)))
      .returning({ id: apiTokens.id });
    if (deleted.length === 0) throw new HTTPException(404, { message: "Token not found." });
    return c.body(null, 204);
  });
