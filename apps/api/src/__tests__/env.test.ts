import { describe, it, expect } from "vitest";
import { EnvError, parseEnv } from "../lib/env";

const validEnv = { DATABASE_URL: "postgresql://user:pass@localhost:5436/issues" };

describe("parseEnv", () => {
  it("fills in defaults when only DATABASE_URL is set", () => {
    const env = parseEnv(validEnv);

    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(4000);
    expect(env.WEB_ORIGIN).toBe("http://localhost:5173");
    expect(env.UPLOADS_DIR).toBe("./data/uploads");
    expect(env.MAX_UPLOADS_BYTES).toBe(20_000_000_000);
  });

  it("reads provided values and coerces numbers", () => {
    const env = parseEnv({ ...validEnv, NODE_ENV: "production", PORT: "8080", MAX_FILE_BYTES: "100" });

    expect(env.NODE_ENV).toBe("production");
    expect(env.PORT).toBe(8080);
    expect(env.MAX_FILE_BYTES).toBe(100);
  });

  it("treats an empty string as unset", () => {
    const env = parseEnv({ ...validEnv, PORT: "", MAX_IMAGE_BYTES: "" });

    expect(env.PORT).toBe(4000);
    expect(env.MAX_IMAGE_BYTES).toBe(10_000_000);
  });

  it("throws an EnvError when DATABASE_URL is missing", () => {
    expect(() => parseEnv({})).toThrow(EnvError);
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it("lists every invalid variable in one error", () => {
    expect(() => parseEnv({ DATABASE_URL: "nope", PORT: "abc", NODE_ENV: "staging" })).toThrow(/DATABASE_URL[\s\S]*PORT[\s\S]*NODE_ENV|NODE_ENV[\s\S]*PORT/);
  });

  it("leaves error reporting off when no DSN is set", () => {
    const env = parseEnv(validEnv);

    expect(env.GLITCHTIP_DSN).toBeUndefined();
    expect(env.GIT_SHA).toBe("dev");
  });

  it("reads a DSN with its environment and the commit", () => {
    const env = parseEnv({ ...validEnv, GLITCHTIP_DSN: "https://key@glitchtip.example.com/3", GLITCHTIP_ENVIRONMENT: "production", GIT_SHA: "abc1234" });

    expect(env.GLITCHTIP_DSN).toBe("https://key@glitchtip.example.com/3");
    expect(env.GLITCHTIP_ENVIRONMENT).toBe("production");
    expect(env.GIT_SHA).toBe("abc1234");
  });

  it("treats blank error reporting values as unset", () => {
    const env = parseEnv({ ...validEnv, GLITCHTIP_DSN: "", GLITCHTIP_ENVIRONMENT: "", GIT_SHA: "" });

    expect(env.GLITCHTIP_DSN).toBeUndefined();
    expect(env.GLITCHTIP_ENVIRONMENT).toBeUndefined();
    expect(env.GIT_SHA).toBe("dev");
  });

  it("rejects a DSN that is not a DSN", () => {
    expect(() => parseEnv({ ...validEnv, GLITCHTIP_DSN: "nonsense", GLITCHTIP_ENVIRONMENT: "production" })).toThrow(/GLITCHTIP_DSN/);
    expect(() => parseEnv({ ...validEnv, GLITCHTIP_DSN: "https://glitchtip.example.com/3", GLITCHTIP_ENVIRONMENT: "production" })).toThrow(/GLITCHTIP_DSN/);
  });

  it("needs an environment whenever a DSN is set", () => {
    expect(() => parseEnv({ ...validEnv, GLITCHTIP_DSN: "https://key@glitchtip.example.com/3" })).toThrow(/GLITCHTIP_ENVIRONMENT/);
  });

  it("rejects zero and negative sizes", () => {
    expect(() => parseEnv({ ...validEnv, MAX_FILE_BYTES: "0" })).toThrow(/MAX_FILE_BYTES/);
    expect(() => parseEnv({ ...validEnv, MAX_UPLOADS_BYTES: "-5" })).toThrow(/MAX_UPLOADS_BYTES/);
  });
});
