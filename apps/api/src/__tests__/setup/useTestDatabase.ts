import { testEnvironment } from "./testEnvironment";

// Runs in each test worker before its test files load, so the app's `db` connects to the test database
process.env.DATABASE_URL = testEnvironment.DATABASE_URL_TEST;
