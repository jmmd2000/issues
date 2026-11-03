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

  it("allows a test worker's copy of a _test database", () => {
    expect(() => assertWipeableDatabase("postgresql://user:pass@localhost:5436/issues_test_w1")).not.toThrow();
    expect(() => assertWipeableDatabase("postgresql://user:pass@localhost:5436/issues_test_w12", ["_test"])).not.toThrow();
  });

  it("refuses names that only look like a worker copy", () => {
    expect(() => assertWipeableDatabase("postgresql://user:pass@localhost:5436/issues_dev_w1")).toThrow(/must end in/);
    expect(() => assertWipeableDatabase("postgresql://user:pass@localhost:5436/issues_test_w0")).toThrow(/must end in/);
    expect(() => assertWipeableDatabase("postgresql://user:pass@localhost:5436/issues_test_wx")).toThrow(/must end in/);
    expect(() => assertWipeableDatabase("postgresql://user:pass@localhost:5436/issues_test_w1_backup")).toThrow(/must end in/);
  });

  it("refuses a worker copy when _test is not allowed", () => {
    expect(() => assertWipeableDatabase("postgresql://user:pass@localhost:5436/issues_test_w1", ["_dev"])).toThrow(/must end in _dev/);
  });

  it("refuses a worker copy on a remote host", () => {
    expect(() => assertWipeableDatabase("postgresql://user:pass@db.example.com:5432/issues_test_w1")).toThrow(/not local/);
  });
});
