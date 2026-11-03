import { describe, it, expect } from "vitest";
import { assertWipeableDatabase } from "../lib/databaseGuard";

describe("assertWipeableDatabase", () => {
  it("allows a local database whose name ends in _dev, _test or _test_e2e", () => {
    expect(() => assertWipeableDatabase("postgresql://user:pass@localhost:5436/issues_dev")).not.toThrow();
    expect(() => assertWipeableDatabase("postgresql://user:pass@127.0.0.1:5436/issues_test")).not.toThrow();
    expect(() => assertWipeableDatabase("postgresql://user:pass@[::1]:5436/issues_test_e2e")).not.toThrow();
  });

  it("refuses a database without a dev or test suffix", () => {
    expect(() => assertWipeableDatabase("postgresql://user:pass@localhost:5436/issues")).toThrow(/must end in _dev, _test or _test_e2e/);
  });

  it("refuses a name that only contains a suffix", () => {
    expect(() => assertWipeableDatabase("postgresql://user:pass@localhost:5436/issues_dev_backup")).toThrow(/must end in/);
  });

  it("refuses a remote host even when the name ends in _dev", () => {
    expect(() => assertWipeableDatabase("postgresql://user:pass@db.example.com:5432/issues_dev")).toThrow(/not local/);
  });

  it("accepts only the suffixes it is given", () => {
    expect(() => assertWipeableDatabase("postgresql://user:pass@localhost:5436/issues_dev", ["_test"])).toThrow(/must end in _test/);
  });
});
