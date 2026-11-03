import { describe, it, expect } from "vitest";
import { INTEGRATION_WORKER_COUNT, workerDatabaseURL } from "./setup/workers";

describe("workerDatabaseURL", () => {
  it("adds the worker number to the database name and keeps the rest", () => {
    expect(workerDatabaseURL("postgresql://user:pass@localhost:5436/issues_test", 2)).toBe("postgresql://user:pass@localhost:5436/issues_test_w2");
  });

  it("refuses a worker number outside the worker count", () => {
    expect(() => workerDatabaseURL("postgresql://user:pass@localhost:5436/issues_test", 0)).toThrow(/no test database/);
    expect(() => workerDatabaseURL("postgresql://user:pass@localhost:5436/issues_test", INTEGRATION_WORKER_COUNT + 1)).toThrow(/no test database/);
    expect(() => workerDatabaseURL("postgresql://user:pass@localhost:5436/issues_test", Number(undefined))).toThrow(/no test database/);
  });
});
