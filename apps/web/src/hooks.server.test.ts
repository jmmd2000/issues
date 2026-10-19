import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as Sentry from "@sentry/node";
import type { HandleServerError } from "@sveltejs/kit";
import { buildServerErrorReportingOptions } from "$lib/server/errorReporting";
import { handleError } from "./hooks.server";

interface SentEvent {
  environment?: string;
  release?: string;
  tags?: Record<string, string>;
}

const searchTerm = "secret-search-term";
let sentEvents: SentEvent[] = [];

/** SvelteKit passes much more than this. The hook only reads these fields. */
function buildErrorInput(status: number): Parameters<HandleServerError>[0] {
  return {
    error: new Error("the api is down"),
    event: { url: new URL(`https://issues.example.com/projects/ISSUE?q=${searchTerm}`), request: new Request("https://issues.example.com", { method: "GET" }) },
    status,
    message: "Internal Error",
  } as unknown as Parameters<HandleServerError>[0];
}

beforeAll(() => {
  Sentry.init({
    ...buildServerErrorReportingOptions({ dsn: "https://key@glitchtip.invalid/2", environment: "production", release: "abc1234" }),
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

describe("handleError", () => {
  it("reports a server error with its method and path, and without the query string", async () => {
    await handleError(buildErrorInput(500));
    await Sentry.flush(2000);

    expect(sentEvents).toHaveLength(1);
    expect(sentEvents[0]).toMatchObject({
      environment: "production",
      release: "abc1234",
      tags: { method: "GET", path: "/projects/ISSUE" },
    });
    expect(JSON.stringify(sentEvents)).not.toContain(searchTerm);
  });

  it("does not report an error below 500, such as a missing page", async () => {
    await handleError(buildErrorInput(404));
    await Sentry.flush(2000);

    expect(sentEvents).toHaveLength(0);
  });

  it("still logs the error to the console", async () => {
    await handleError(buildErrorInput(404));

    expect(console.error).toHaveBeenCalledWith("Unhandled error:", expect.any(Error), { path: "/projects/ISSUE", method: "GET" });
  });
});
