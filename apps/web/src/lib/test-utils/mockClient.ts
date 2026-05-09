import { vi } from "vitest";

const HONO_VERBS = new Set(["$get", "$post", "$patch", "$put", "$delete"]);

type MockResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

function mockResponse(body: unknown = {}, ok = true, status = 200): MockResponse {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  };
}

/**
 * Builds a recursive Proxy that mirrors the Hono RPC client. Path segments
 * (e.g. `api.projects[":key"].tickets`) lazily walk deeper; verb methods
 * ($get/$post/...) resolve to a memoised vi.fn() spy that returns an ok 200
 * response by default. Use mockResolvedValueOnce on a verb spy to override
 * a specific call.
 */
function makeNode(): unknown {
  const children = new Map<string, unknown>();
  return new Proxy(() => undefined, {
    get(_target, prop) {
      if (typeof prop === "symbol") return undefined;
      const key = String(prop);
      const cached = children.get(key);
      if (cached !== undefined) return cached;
      const value = HONO_VERBS.has(key) ? vi.fn().mockResolvedValue(mockResponse()) : makeNode();
      children.set(key, value);
      return value;
    },
  });
}

export type MockClient = { api: ReturnType<typeof makeNode> & Record<string, unknown> };

export function createMockClient(): MockClient {
  return { api: makeNode() as Record<string, unknown> };
}

export { mockResponse };
