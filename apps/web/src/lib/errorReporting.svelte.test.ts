import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as Sentry from "@sentry/svelte";
import { buildBrowserErrorReportingOptions } from "./errorReporting";

interface SentEvent {
  environment?: string;
  release?: string;
  request?: { url?: string; headers?: Record<string, string>; cookies?: unknown; query_string?: unknown };
  breadcrumbs?: { category?: string; data?: { url?: string } }[];
}

const searchTerm = "secret-search-term";
let sentEvents: SentEvent[] = [];

beforeAll(() => {
  Sentry.init({
    ...buildBrowserErrorReportingOptions({ dsn: "https://key@glitchtip.invalid/2", environment: "production", release: "abc1234" }),
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
});

describe("browser error reporting", () => {
  it("sends a page error with the page address and User-Agent, and without the query string", async () => {
    history.replaceState(null, "", `/search?q=${searchTerm}#results`);

    Sentry.captureException(new Error("the page broke"));
    await Sentry.flush(2000);

    expect(sentEvents).toHaveLength(1);
    expect(sentEvents[0]).toMatchObject({ environment: "production", release: "abc1234" });
    expect(sentEvents[0].request?.url).toMatch(/\/search$/);
    expect(Object.keys(sentEvents[0].request?.headers ?? {})).toEqual(["User-Agent"]);
    expect(JSON.stringify(sentEvents)).not.toContain(searchTerm);
  });

  it("records a request as a breadcrumb without its query string", async () => {
    await fetch(`/@vite/client?token=${searchTerm}`);

    Sentry.captureException(new Error("the page broke"));
    await Sentry.flush(2000);

    const fetchBreadcrumb = sentEvents[0].breadcrumbs?.find(breadcrumb => breadcrumb.category === "fetch");
    expect(fetchBreadcrumb?.data?.url).toMatch(/\/@vite\/client$/);
    expect(JSON.stringify(sentEvents)).not.toContain(searchTerm);
  });
});
