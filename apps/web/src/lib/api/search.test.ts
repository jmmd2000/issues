import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchFilterOptions, SearchResult } from "@issues/api";
import { mockResponse } from "$lib/test-utils/mockClient";

const mockClientState = vi.hoisted(() => ({
  createClient: vi.fn(),
  filtersGet: vi.fn(),
  searchGet: vi.fn(),
}));

vi.mock("./client", () => ({
  createClient: mockClientState.createClient,
}));

import { hasSearchCriteria, loadSearchPageResult, parseSearchPageState, serialiseSearchPageState, type SearchPageState } from "./search";

const filters: SearchFilterOptions = {
  projects: [{ id: "p-1", key: "CORE", name: "Core", visibility: "private" }],
  statuses: [{ slug: "todo", name: "Todo", category: "active" }],
  labels: [{ name: "bug", colour: "#cc3333" }],
  assignees: [{ id: "u-1", name: "Alex Member", avatarURL: null }],
};

const ticket: SearchResult = {
  id: "t-1",
  number: 12,
  title: "Searchable ticket",
  description: "Description match",
  priority: "high",
  visibility: "private",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  project: { id: "p-1", key: "CORE", name: "Core", visibility: "private" },
  status: { id: "s-1", slug: "todo", name: "Todo", category: "active" },
  assignee: { id: "u-1", name: "Alex Member", avatarURL: null },
  labels: [{ id: "l-1", name: "bug", colour: "#cc3333" }],
  highlights: {
    title: [
      { text: "Searchable", highlighted: true },
      { text: " ticket", highlighted: false },
    ],
    description: [
      { text: "Description ", highlighted: false },
      { text: "match", highlighted: true },
    ],
  },
};

function makeUrl(path: string): URL {
  return new URL(path, "http://localhost");
}

function makeState(overrides: Partial<SearchPageState> = {}): SearchPageState {
  return {
    searchTerm: "",
    projectKey: null,
    statusSlugs: [],
    priorities: [],
    labelNames: [],
    assigneeIDs: [],
    page: 1,
    perPage: 25,
    ...overrides,
  };
}

function fetchStub(): typeof fetch {
  return vi.fn() as unknown as typeof fetch;
}

beforeEach(() => {
  mockClientState.filtersGet.mockReset();
  mockClientState.searchGet.mockReset();
  mockClientState.createClient.mockReset();

  mockClientState.filtersGet.mockResolvedValue(mockResponse({ filters }));
  mockClientState.searchGet.mockResolvedValue(mockResponse({ tickets: [ticket], hasNextPage: true }));
  mockClientState.createClient.mockReturnValue({
    api: {
      search: {
        filters: { $get: mockClientState.filtersGet },
        $get: mockClientState.searchGet,
      },
    },
  });
});

describe("parseSearchPageState", () => {
  it("parses query text, list filters, and pagination from URL params", () => {
    const url = makeUrl("/search?q=%20api%20&project=core&status=todo,done&status=review&priority=high&priority=invalid&label=bug,api&assignee=u-1&assignee=u-2&page=2&perPage=50");

    expect(parseSearchPageState(url)).toEqual({
      searchTerm: "api",
      projectKey: "CORE",
      statusSlugs: ["todo", "done", "review"],
      priorities: ["high"],
      labelNames: ["bug", "api"],
      assigneeIDs: ["u-1", "u-2"],
      page: 2,
      perPage: 50,
    });
  });

  it("uses the locked project key over any project URL param", () => {
    const url = makeUrl("/projects/core/search?project=OTHER&q=api");

    expect(parseSearchPageState(url, "CORE")).toMatchObject({
      searchTerm: "api",
      projectKey: "CORE",
    });
  });
});

describe("serialiseSearchPageState", () => {
  it("serialises compact list params and omits default pagination", () => {
    const params = serialiseSearchPageState(
      makeState({
        searchTerm: "  api failure  ",
        projectKey: "CORE",
        statusSlugs: ["todo", "done"],
        priorities: ["high", "critical"],
        labelNames: ["bug", "api"],
        assigneeIDs: ["u-1"],
      })
    );

    expect(params.toString()).toBe("q=api+failure&project=CORE&status=todo%2Cdone&priority=high%2Ccritical&label=bug%2Capi&assignee=u-1");
  });

  it("omits the project param when the search route is project-scoped", () => {
    const params = serialiseSearchPageState(makeState({ projectKey: "CORE", page: 3, perPage: 10 }), "CORE");

    expect(params.toString()).toBe("page=3&perPage=10");
  });
});

describe("hasSearchCriteria", () => {
  it("treats a global project filter as criteria", () => {
    expect(hasSearchCriteria(makeState({ projectKey: "CORE" }))).toBe(true);
  });

  it("ignores the locked project scope when no real search filters are selected", () => {
    expect(hasSearchCriteria(makeState({ projectKey: "CORE" }), "CORE")).toBe(false);
  });

  it("treats text and structured filters as criteria inside a locked project", () => {
    expect(hasSearchCriteria(makeState({ projectKey: "CORE", statusSlugs: ["todo"] }), "CORE")).toBe(true);
  });
});

describe("loadSearchPageResult", () => {
  it("loads filters only when no criteria are selected", async () => {
    const result = await loadSearchPageResult({ fetch: fetchStub(), url: makeUrl("/search") });

    expect(mockClientState.filtersGet).toHaveBeenCalledWith({ query: {} });
    expect(mockClientState.searchGet).not.toHaveBeenCalled();
    expect(result).toEqual({
      state: makeState(),
      filters,
      tickets: [],
      hasNextPage: false,
      searched: false,
    });
  });

  it("forwards text, filters, pagination, and locked project scope to the search endpoint", async () => {
    const url = makeUrl("/projects/core/search?q=api&status=todo&priority=high&label=bug&assignee=u-1&page=2");
    const result = await loadSearchPageResult({ fetch: fetchStub(), url, lockedProjectKey: "core" });

    expect(mockClientState.filtersGet).toHaveBeenCalledWith({ query: { project: "CORE" } });
    expect(mockClientState.searchGet).toHaveBeenCalledWith({
      query: {
        q: "api",
        project: "CORE",
        status: ["todo"],
        priority: ["high"],
        label: ["bug"],
        assignee: ["u-1"],
        page: "2",
        perPage: "25",
      },
    });
    expect(result).toMatchObject({
      state: makeState({
        searchTerm: "api",
        projectKey: "CORE",
        statusSlugs: ["todo"],
        priorities: ["high"],
        labelNames: ["bug"],
        assigneeIDs: ["u-1"],
        page: 2,
      }),
      filters,
      tickets: [ticket],
      hasNextPage: true,
      searched: true,
    });
  });

  it("throws a readable error when filters fail to load", async () => {
    mockClientState.filtersGet.mockResolvedValueOnce(mockResponse({}, false, 503));

    await expect(loadSearchPageResult({ fetch: fetchStub(), url: makeUrl("/search") })).rejects.toThrow("Failed to load search filters (503).");
  });

  it("throws a readable error when search results fail to load", async () => {
    mockClientState.searchGet.mockResolvedValueOnce(mockResponse({}, false, 422));

    await expect(loadSearchPageResult({ fetch: fetchStub(), url: makeUrl("/search?q=api") })).rejects.toThrow("Failed to load search results (422).");
  });
});
