import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../db";
import { apiTokens } from "../db/schema";

const TOKEN_BYTES = 32;
const TOKEN_HEX_LENGTH = TOKEN_BYTES * 2;
const HEX_PATTERN = /^[a-f0-9]+$/;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const TOKEN_EXPIRY_MIN_DAYS = 1;
export const TOKEN_EXPIRY_MAX_DAYS = 365;
export const TOKEN_EXPIRY_DEFAULT_DAYS = 90;

function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

function isWellFormedRawToken(raw: string) {
  return raw.length === TOKEN_HEX_LENGTH && HEX_PATTERN.test(raw);
}

const tokenColumns = {
  id: apiTokens.id,
  name: apiTokens.name,
  lastUsedAt: apiTokens.lastUsedAt,
  expiresAt: apiTokens.expiresAt,
  createdAt: apiTokens.createdAt,
} as const;

export class TokenService {
  /**
   * Creates an API token for the given user. Generates a 32-byte random hex
   * value, returns it to the caller exactly once, and stores only its SHA-256
   * hash in the database.
   * @param userID Owner of the token
   * @param name Human-readable label (already trimmed by Zod)
   * @param expiresInDays Days until expiry (already clamped by Zod)
   * @returns The raw token (shown once) and the persisted record minus the hash
   */
  static async createToken(userID: string, name: string, expiresInDays: number) {
    const token = randomBytes(TOKEN_BYTES).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + expiresInDays * MS_PER_DAY);

    const [apiToken] = await db.insert(apiTokens).values({ userID, name, tokenHash, expiresAt }).returning(tokenColumns);

    return { token, apiToken };
  }

  /**
   * Lists every token owned by the user, newest first. The hash is never
   * returned.
   * @param userID Owner
   * @returns Persisted records minus the hash
   */
  static async listTokens(userID: string) {
    return await db.select(tokenColumns).from(apiTokens).where(eq(apiTokens.userID, userID)).orderBy(desc(apiTokens.createdAt));
  }

  /**
   * Revokes a token. Returns 404 if the token does not exist or belongs to a
   * different user, mirroring the private-project visibility rule.
   * @param userID Owner
   * @param id Token id
   * @throws {HTTPException} 404 if no row was deleted
   */
  static async revokeToken(userID: string, id: string) {
    const deleted = await db
      .delete(apiTokens)
      .where(and(eq(apiTokens.id, id), eq(apiTokens.userID, userID)))
      .returning({ id: apiTokens.id });
    if (deleted.length === 0) throw new HTTPException(404, { message: "Token not found." });
  }

  /**
   * Resolves a raw bearer token to its owner. Hashes the input, looks up the
   * row, verifies it has not expired, and bumps `lastUsedAt`. Wrong shape,
   * unknown hash, and expired rows all collapse to `null` so callers cannot
   * distinguish them.
   * @param raw Raw token from the Authorization header
   * @returns userID + token id if valid, null otherwise
   */
  static async findByRawToken(raw: string) {
    if (!isWellFormedRawToken(raw)) return null;

    const tokenHash = hashToken(raw);
    const [row] = await db
      .select({ id: apiTokens.id, userID: apiTokens.userID })
      .from(apiTokens)
      .where(and(eq(apiTokens.tokenHash, tokenHash), gt(apiTokens.expiresAt, new Date())))
      .limit(1);

    if (!row) return null;

    await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.id));
    return row;
  }
}
