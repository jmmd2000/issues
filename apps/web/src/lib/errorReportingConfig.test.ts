import { describe, expect, it } from "vitest";
import { parseErrorReportingConfig } from "./errorReportingConfig";

describe("parseErrorReportingConfig", () => {
  it("is off when no DSN is set", () => {
    expect(parseErrorReportingConfig({})).toBeUndefined();
  });

  it("reads a DSN with its environment and the commit", () => {
    const config = parseErrorReportingConfig({
      PUBLIC_GLITCHTIP_DSN: "https://key@glitchtip.example.com/2",
      PUBLIC_GLITCHTIP_ENVIRONMENT: "production",
      PUBLIC_GIT_SHA: "abc1234",
    });

    expect(config).toEqual({ dsn: "https://key@glitchtip.example.com/2", environment: "production", release: "abc1234" });
  });

  it("treats blank values as unset and defaults the release to dev", () => {
    expect(parseErrorReportingConfig({ PUBLIC_GLITCHTIP_DSN: "", PUBLIC_GLITCHTIP_ENVIRONMENT: "", PUBLIC_GIT_SHA: "" })).toBeUndefined();
    expect(parseErrorReportingConfig({ PUBLIC_GLITCHTIP_DSN: "https://key@glitchtip.example.com/2", PUBLIC_GLITCHTIP_ENVIRONMENT: "staging" })?.release).toBe("dev");
  });

  it("rejects a DSN that is not a DSN", () => {
    expect(() => parseErrorReportingConfig({ PUBLIC_GLITCHTIP_DSN: "nonsense", PUBLIC_GLITCHTIP_ENVIRONMENT: "production" })).toThrow(/PUBLIC_GLITCHTIP_DSN/);
    expect(() => parseErrorReportingConfig({ PUBLIC_GLITCHTIP_DSN: "https://glitchtip.example.com/2", PUBLIC_GLITCHTIP_ENVIRONMENT: "production" })).toThrow(/PUBLIC_GLITCHTIP_DSN/);
  });

  it("needs an environment whenever a DSN is set", () => {
    expect(() => parseErrorReportingConfig({ PUBLIC_GLITCHTIP_DSN: "https://key@glitchtip.example.com/2" })).toThrow(/PUBLIC_GLITCHTIP_ENVIRONMENT/);
  });
});
