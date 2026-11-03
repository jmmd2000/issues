import { describe, expect, it } from "vitest";
import { addSources } from "./contentSecurityPolicy";

const policy = "default-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'";

describe("addSources", () => {
  it("adds sources to the named directive and leaves the others alone", () => {
    expect(addSources(policy, "connect-src", ["http://localhost:4000", "https://glitchtip.example.com"])).toBe(
      "default-src 'self'; connect-src 'self' http://localhost:4000 https://glitchtip.example.com; img-src 'self' data:; frame-ancestors 'none'"
    );
  });

  it("skips a source the directive already lists", () => {
    expect(addSources(policy, "img-src", ["data:", "http://localhost:4000"])).toBe("default-src 'self'; connect-src 'self'; img-src 'self' data: http://localhost:4000; frame-ancestors 'none'");
  });

  it("does not match a directive whose name only starts the same", () => {
    expect(() => addSources("default-src 'self'; connect-src-elem 'self'", "connect-src", ["https://glitchtip.example.com"])).toThrow(/no connect-src directive/);
  });

  it("throws when the directive is missing, so the default-src fallback is never replaced by accident", () => {
    expect(() => addSources("default-src 'self'", "connect-src", ["https://glitchtip.example.com"])).toThrow(/no connect-src directive/);
  });
});
