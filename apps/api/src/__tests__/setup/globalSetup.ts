import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { assertTestDatabase } from "./assertTestDatabase";
import { testEnvironment } from "./testEnvironment";

const migrationsFolder = path.resolve(import.meta.dirname, "../../../drizzle");

/** Creates the test database on its server if it does not exist yet. */
async function createDatabaseIfMissing(databaseURL: string): Promise<void> {
  const url = new URL(databaseURL);
  const databaseName = url.pathname.slice(1);
  url.pathname = "/postgres";

  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);
    if (existing.rowCount) return;
    await client.query(`CREATE DATABASE ${client.escapeIdentifier(databaseName)}`);
  } finally {
    await client.end();
  }
}

/** Creates the test database if needed and brings it up to date once, before any test runs. */
export default async function globalSetup(): Promise<void> {
  const databaseURL = testEnvironment.DATABASE_URL_TEST;
  assertTestDatabase(databaseURL, process.env.NODE_ENV);
  await createDatabaseIfMissing(databaseURL);

  const database = drizzle(databaseURL);
  try {
    await migrate(database, { migrationsFolder });
  } finally {
    await database.$client.end();
  }
}
