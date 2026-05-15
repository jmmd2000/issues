import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IssuesApiError, IssuesClient } from "../client.js";

const API_URL = "http://localhost:4000";
const TOKEN = "abc123";

function mockFetch(response: { status?: number; body?: unknown; bodyText?: string }) {
  const status = response.status ?? 200;
  const body = response.bodyText !== undefined ? response.bodyText : JSON.stringify(response.body ?? {});
  // Build a fresh Response on each call so consumed bodies don't break re-invocation.
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(body, { status })));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

let client: IssuesClient;

beforeEach(() => {
  client = new IssuesClient(API_URL, TOKEN);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("IssuesClient", () => {
  it("adds the Authorization header to every request", async () => {
    const fetchMock = mockFetch({ body: { projects: [] } });
    await client.listProjects();
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = request.headers as Headers;
    expect(headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
  });

  it("sets Content-Type for requests with a body", async () => {
    const fetchMock = mockFetch({ status: 201, body: { ticket: {} } });
    await client.createTicket({ project: "DASH", title: "x" });
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = request.headers as Headers;
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("returns parsed JSON on success", async () => {
    mockFetch({ body: { projects: [{ key: "DASH", name: "Dashboard" }] } });
    const result = await client.listProjects();
    expect(result.projects).toEqual([{ key: "DASH", name: "Dashboard" }]);
  });

  it("throws IssuesApiError with the API message on non-2xx", async () => {
    mockFetch({ status: 404, body: { message: "Project NOPE not found." } });
    await expect(client.listProjects()).rejects.toMatchObject({ status: 404, message: "Project NOPE not found." });
    await expect(client.listProjects()).rejects.toBeInstanceOf(IssuesApiError);
  });

  it("falls back to raw text when the error response is not JSON", async () => {
    mockFetch({ status: 500, bodyText: "internal kaboom" });
    await expect(client.listProjects()).rejects.toMatchObject({ status: 500, message: "internal kaboom" });
  });

  it("encodes ticket refs in URL paths", async () => {
    const fetchMock = mockFetch({ body: { ticket: {} } });
    await client.getTicket("DASH-12");
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe(`${API_URL}/api/mcp/tickets/DASH-12`);
  });

  it("serialises search filters as repeated query params", async () => {
    const fetchMock = mockFetch({ body: { tickets: [], total: 0, page: 1, perPage: 10, hasNextPage: false } });
    await client.searchTickets({ project: "DASH", status: ["in-progress", "in-review"], priority: ["high"], perPage: 10, page: 2 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("project=DASH");
    expect(url).toContain("status=in-progress");
    expect(url).toContain("status=in-review");
    expect(url).toContain("priority=high");
    expect(url).toContain("perPage=10");
    expect(url).toContain("page=2");
  });
});
