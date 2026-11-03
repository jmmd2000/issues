import { sql } from "drizzle-orm";
import { assertWipeableDatabase } from "../lib/databaseGuard";
import { getEnv } from "../lib/env";
import { db } from "./index";

/**
 * Empties every table in the app's database. Migration history lives in its
 * own schema, so it stays.
 * @returns The number of tables it emptied
 * @throws Error when the database is not local or its name doesn't end in _dev, _test or _test_e2e
 */
export async function wipeDatabase(): Promise<number> {
  assertWipeableDatabase(getEnv().DATABASE_URL);

  const { rows } = await db.execute<{ tablename: string }>(sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
  if (rows.length === 0) return 0;

  const tables = sql.join(
    rows.map(row => sql.identifier(row.tablename)),
    sql`, `
  );
  await db.execute(sql`TRUNCATE TABLE ${tables} CASCADE`);
  return rows.length;
}
