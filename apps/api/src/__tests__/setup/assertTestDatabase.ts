import { assertWipeableDatabase } from "../../lib/databaseGuard";

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

  assertWipeableDatabase(databaseURL, ["_test"]);
}
