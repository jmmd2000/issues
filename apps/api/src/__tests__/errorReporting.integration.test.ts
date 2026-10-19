import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as Sentry from "@sentry/node";
import { serve } from "@hono/node-server";
import { HTTPException } from "hono/http-exception";
import app from "../index";
import { buildErrorReportingOptions } from "../lib/errorReporting";
import { AuthService } from "../services/authService";

interface SentEvent {
  environment?: string;
  release?: string;
  tags?: Record<string, string>;
}

const password = "correct-horse-battery-staple";
const sessionCookie = "session_id=secret-session-cookie-value";
const authorisation = "Bearer secret-authorisation-value";
const searchTerm = "secret-search-term";
const HTTP_THROW_PATH = "/api/__test__/reporting-throw-http";

let sentEvents: SentEvent[] = [];

beforeAll(() => {
  app.get(HTTP_THROW_PATH, () => {
    throw new HTTPException(418, { message: "teapot" });
  });
  Sentry.init({
    ...buildErrorReportingOptions("https://key@glitchtip.invalid/1", "production", "abc1234"),
    transport: () => ({
      send: async envelope => {
        for (const [header, payload] of envelope[1]) {
          if (header.type === "event") sentEvents.push(payload as SentEvent);
        }
        return {};
      },
      flush: async () => true,
    }),
  });
});

afterAll(async () => {
  await Sentry.close();
});

beforeEach(() => {
  sentEvents = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Runs the app as a real HTTP server, so the SDK sees the same requests it sees in production. */
function listen(): Promise<{ url: string; close: () => void }> {
  return new Promise(resolve => {
    const server = serve({ fetch: app.fetch, port: 0 }, info => {
      resolve({ url: `http://127.0.0.1:${info.port}`, close: () => server.close() });
    });
  });
}

describe("error reporting", () => {
  it("reports an unexpected error with its method and path, and without request data", async () => {
    vi.spyOn(AuthService, "loginUser").mockRejectedValue(new Error("the database is down"));
    const server = await listen();

    const res = await fetch(`${server.url}/api/auth/login?q=${searchTerm}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie, Authorization: authorisation },
      body: JSON.stringify({ email: "james@example.com", password }),
    });
    await Sentry.flush(2000);
    server.close();

    expect(res.status).toBe(500);
    expect(sentEvents).toHaveLength(1);
    expect(sentEvents[0]).toMatchObject({ environment: "production", release: "abc1234", tags: { method: "POST", path: "/api/auth/login" } });
    const sent = JSON.stringify(sentEvents);
    for (const secret of [password, sessionCookie, authorisation, searchTerm]) {
      expect(sent).not.toContain(secret);
    }
  });

  it("does not report an error that the API returns on purpose", async () => {
    const res = await app.request(HTTP_THROW_PATH);
    await Sentry.flush(2000);

    expect(res.status).toBe(418);
    expect(sentEvents).toHaveLength(0);
  });
});
