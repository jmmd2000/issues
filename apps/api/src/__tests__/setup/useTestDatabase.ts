import { testEnvironment } from "./testEnvironment";
import { workerDatabaseURL } from "./workers";

// Runs in each test worker before its test files load, so the app's `db` connects to this worker's copy of the test database
process.env.DATABASE_URL = workerDatabaseURL(testEnvironment.DATABASE_URL_TEST, Number(process.env.VITEST_POOL_ID));
