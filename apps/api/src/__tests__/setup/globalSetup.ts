import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { assertTestDatabase } from "./assertTestDatabase";
import { testEnvironment } from "./testEnvironment";
import { INTEGRATION_WORKER_COUNT, workerDatabaseURL } from "./workers";

const migrationsFolder = path.resolve(import.meta.dirname, "../../../drizzle");

function databaseName(databaseURL: string): string {
  return new URL(databaseURL).pathname.slice(1);
}

/** Runs `work` with a client connected to the server's `postgres` database, which is never wiped. */
async function withServerClient(databaseURL: string, work: (client: Client) => Promise<void>): Promise<void> {
  const url = new URL(databaseURL);
  url.pathname = "/postgres";

  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    await work(client);
  } finally {
    await client.end();
  }
}

/** Creates the test database on its server if it does not exist yet. */
async function createDatabaseIfMissing(databaseURL: string): Promise<void> {
  await withServerClient(databaseURL, async client => {
    const name = databaseName(databaseURL);
    const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (existing.rowCount) return;
    await client.query(`CREATE DATABASE ${client.escapeIdentifier(name)}`);
  });
}

/** Drops each worker copy, including any an interrupted run left behind. */
async function dropWorkerDatabases(workerURLs: string[]): Promise<void> {
  await withServerClient(workerURLs[0], async client => {
    for (const workerURL of workerURLs) {
      await client.query(`DROP DATABASE IF EXISTS ${client.escapeIdentifier(databaseName(workerURL))} WITH (FORCE)`);
    }
  });
}

/** Makes a fresh copy of the migrated test database for each worker. */
async function createWorkerDatabases(testDatabaseURL: string, workerURLs: string[]): Promise<void> {
  await withServerClient(testDatabaseURL, async client => {
    const template = client.escapeIdentifier(databaseName(testDatabaseURL));
    for (const workerURL of workerURLs) {
      await client.query(`CREATE DATABASE ${client.escapeIdentifier(databaseName(workerURL))} TEMPLATE ${template}`);
    }
  });
}

/**
 * Brings the test database up to date, then copies it once for each worker
 * before any test runs. Returns the teardown, which drops the copies.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  const testDatabaseURL = testEnvironment.DATABASE_URL_TEST;
  assertTestDatabase(testDatabaseURL, process.env.NODE_ENV);
  await createDatabaseIfMissing(testDatabaseURL);

  const database = drizzle(testDatabaseURL);
  try {
    await migrate(database, { migrationsFolder });
  } finally {
    await database.$client.end();
  }

  const workerURLs = Array.from({ length: INTEGRATION_WORKER_COUNT }, (_, index) => workerDatabaseURL(testDatabaseURL, index + 1));
  for (const workerURL of workerURLs) assertTestDatabase(workerURL, process.env.NODE_ENV);
  await dropWorkerDatabases(workerURLs);
  await createWorkerDatabases(testDatabaseURL, workerURLs);

  return () => dropWorkerDatabases(workerURLs);
}
