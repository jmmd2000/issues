import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import type { SearchFilterOptions, SearchResult } from "@issues/api";
import { defaultSearchSortColumn, defaultSearchSortDirection, type SearchPageResult, type SearchPageState } from "$lib/api/search";

const mockApp = vi.hoisted(() => ({
  goto: vi.fn(),
  page: { url: new URL("http://localhost/search") },
  navigating: { to: null as null | { url: URL } },
}));

vi.mock("$app/navigation", () => ({
  goto: mockApp.goto,
}));

vi.mock("$app/state", () => ({
  page: mockApp.page,
  navigating: mockApp.navigating,
}));

import SearchPage from "./SearchPage.svelte";

const filters: SearchFilterOptions = {
  projects: [
    { id: "p-1", key: "CORE", name: "Core", visibility: "private" },
    { id: "p-2", key: "WEB", name: "Web", visibility: "public" },
  ],
  statuses: [
    { slug: "todo", name: "Todo", category: "active" },
    { slug: "done", name: "Done", category: "done" },
  ],
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

function makeState(overrides: Partial<SearchPageState> = {}): SearchPageState {
  const searchTerm = overrides.searchTerm ?? "";
  const sortBy = defaultSearchSortColumn(searchTerm, overrides.sortBy);

  return {
    searchTerm,
    projectKey: null,
    statusSlugs: [],
    priorities: [],
    labelNames: [],
    assigneeIDs: [],
    page: 1,
    perPage: 25,
    sortBy,
    sortDirection: defaultSearchSortDirection(sortBy, overrides.sortDirection),
    ...overrides,
  };
}

function makeSearch(overrides: Partial<SearchPageResult> = {}): SearchPageResult {
  return {
    state: makeState(),
    filters,
    tickets: [],
    hasNextPage: false,
    searched: false,
    ...overrides,
  };
}

function expectGoto(path: string): void {
  expect(mockApp.goto).toHaveBeenCalledWith(path, { keepFocus: true, noScroll: true });
}

beforeEach(() => {
  mockApp.goto.mockReset();
  mockApp.goto.mockResolvedValue(undefined);
  mockApp.page.url = new URL("http://localhost/search");
  mockApp.navigating.to = null;
});

describe("SearchPage", () => {
  it("renders the empty state and syntax hints before a search runs", async () => {
    const screen = render(SearchPage, { search: makeSearch() });

    await expect.element(screen.getByRole("heading", { name: "Search" })).toBeVisible();
    await expect.element(screen.getByText("No query or filters selected.")).toBeVisible();
    await expect.element(screen.getByText('"exact phrase"')).toBeVisible();
    await expect.element(screen.getByText("-excluded")).toBeVisible();
  });

  it("updates the URL after typing in the search input", async () => {
    const screen = render(SearchPage, { search: makeSearch() });

    await screen.getByLabelText("Search tickets").fill("login bug");

    await vi.waitFor(() => {
      expectGoto("/search?q=login+bug");
    });
  });

  it("updates the URL immediately when a structured filter changes", async () => {
    const screen = render(SearchPage, { search: makeSearch() });

    await screen.getByText("Todo").click();

    await vi.waitFor(() => {
      expectGoto("/search?status=todo");
    });
  });

  it("clears text and filters from the URL", async () => {
    const screen = render(SearchPage, {
      search: makeSearch({
        state: makeState({
          searchTerm: "api",
          projectKey: "CORE",
          statusSlugs: ["todo"],
          page: 3,
        }),
        searched: true,
        tickets: [ticket],
      }),
    });

    await screen.getByRole("button", { name: "Clear" }).click();

    expectGoto("/search");
  });

  it("keeps the query when changing result pages", async () => {
    const screen = render(SearchPage, {
      search: makeSearch({
        state: makeState({ searchTerm: "api", page: 2 }),
        searched: true,
        tickets: [ticket],
        hasNextPage: true,
      }),
    });

    await screen.getByRole("button", { name: "Next" }).click();
    expectGoto("/search?q=api&page=3");

    mockApp.goto.mockClear();
    await screen.getByRole("button", { name: "Previous" }).click();
    expectGoto("/search?q=api");
  });

  it("hides the project filter and omits project params on a project-scoped search page", async () => {
    mockApp.page.url = new URL("http://localhost/projects/core/search");
    const screen = render(SearchPage, {
      lockedProjectKey: "core",
      search: makeSearch({
        state: makeState({ projectKey: "CORE" }),
      }),
    });

    expect(screen.getByText("All projects").elements()).toHaveLength(0);

    await screen.getByText("Todo").click();

    await vi.waitFor(() => {
      expectGoto("/projects/core/search?status=todo");
    });
  });
});
