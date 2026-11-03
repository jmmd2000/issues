import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { wipeDatabase } from "../db/wipe";
import { createAuthenticatedUser, createProject, createTicketInProject, resetDatabase } from "./helpers";

describe("wipeDatabase", () => {
  it("empties every table and keeps the migration history", async () => {
    await resetDatabase();
    const { cookies } = await createAuthenticatedUser();
    await createProject(cookies);
    await createTicketInProject(cookies, "TEST", "A ticket to wipe");

    const tableCount = await wipeDatabase();

    const { rows: tables } = await db.execute<{ tablename: string }>(sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
    expect(tableCount).toBe(tables.length);
    for (const { tablename } of tables) {
      const { rows } = await db.execute<{ count: number }>(sql`SELECT count(*)::int AS count FROM ${sql.identifier(tablename)}`);
      expect(rows[0].count, tablename).toBe(0);
    }
    const { rows: migrations } = await db.execute<{ count: number }>(sql`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`);
    expect(migrations[0].count).toBeGreaterThan(0);
  });
});
