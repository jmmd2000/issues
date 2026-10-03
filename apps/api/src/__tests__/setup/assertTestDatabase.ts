const localHosts = ["localhost", "127.0.0.1", "[::1]"];
const testDatabaseSuffix = "_test";

/**
 * Throws unless tests are running (NODE_ENV=test) against a local database whose
 * name ends in `_test`. Tests wipe tables, so this stops them reaching a dev or
 * production database.
 * @param databaseURL The connection string the tests would use
 * @param nodeEnv The current NODE_ENV, normally `process.env.NODE_ENV`
 * @throws Error naming the rule that failed
 */
export function assertTestDatabase(databaseURL: string, nodeEnv: string | undefined): void {
  if (nodeEnv !== "test") {
    throw new Error(`Refusing to wipe for tests: NODE_ENV is "${nodeEnv}", not "test"`);
  }

  const url = new URL(databaseURL);
  const databaseName = url.pathname.slice(1);

  if (!localHosts.includes(url.hostname)) {
    throw new Error(`Refusing to wipe "${databaseName}": host "${url.hostname}" is not local`);
  }

  if (!databaseName.endsWith(testDatabaseSuffix)) {
    throw new Error(`Refusing to wipe "${databaseName}": the name must end in ${testDatabaseSuffix}`);
  }
}
