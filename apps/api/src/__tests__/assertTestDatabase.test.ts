import { describe, it, expect } from "vitest";
import { assertTestDatabase } from "./setup/assertTestDatabase";

describe("assertTestDatabase", () => {
  it("allows a local database whose name ends in _test", () => {
    expect(() => assertTestDatabase("postgresql://user:pass@localhost:5436/issues_test", "test")).not.toThrow();
    expect(() => assertTestDatabase("postgresql://user:pass@127.0.0.1:5436/issues_test", "test")).not.toThrow();
  });

  it("refuses the dev database", () => {
    expect(() => assertTestDatabase("postgresql://user:pass@localhost:5436/issues", "test")).toThrow(/must end in _test/);
  });

  it("refuses a name that only contains _test", () => {
    expect(() => assertTestDatabase("postgresql://user:pass@localhost:5436/issues_test_backup", "test")).toThrow(/must end in _test/);
  });

  it("refuses a remote host even when the name ends in _test", () => {
    expect(() => assertTestDatabase("postgresql://user:pass@db.example.com:5432/issues_test", "test")).toThrow(/not local/);
  });

  it("refuses to run outside NODE_ENV=test", () => {
    expect(() => assertTestDatabase("postgresql://user:pass@localhost:5436/issues_test", "development")).toThrow(/NODE_ENV/);
    expect(() => assertTestDatabase("postgresql://user:pass@localhost:5436/issues_test", undefined)).toThrow(/NODE_ENV/);
  });
});
