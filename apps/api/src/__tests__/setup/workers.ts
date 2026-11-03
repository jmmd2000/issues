/** How many API integration test files run at once. Each worker has its own copy of the test database. */
export const INTEGRATION_WORKER_COUNT = 4;

/**
 * Returns the connection string of one worker's copy of the test database.
 * @param testDatabaseURL The connection string of the test database, such as `.../issues_test`
 * @param workerID The worker number, from 1 to {@link INTEGRATION_WORKER_COUNT}
 * @returns The same connection string with `_w<workerID>` added to the database name
 * @throws Error when the worker number is out of range
 */
export function workerDatabaseURL(testDatabaseURL: string, workerID: number): string {
  if (!Number.isInteger(workerID) || workerID < 1 || workerID > INTEGRATION_WORKER_COUNT) {
    throw new Error(`Worker ${workerID} has no test database. Workers run from 1 to ${INTEGRATION_WORKER_COUNT}.`);
  }

  const url = new URL(testDatabaseURL);
  url.pathname = `${url.pathname}_w${workerID}`;
  return url.toString();
}
