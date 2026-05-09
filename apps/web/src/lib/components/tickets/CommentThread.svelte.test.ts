import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "vitest-browser-svelte";
import { makeComment } from "$lib/test-utils/fixtures";

vi.mock("$lib/api/client", async () => {
  const { createMockClient } = await import("$lib/test-utils/mockClient");
  const client = createMockClient();
  return { client, createClient: () => client };
});

import CommentThread from "./CommentThread.svelte";

const baseProps = {
  comments: [],
  projectKey: "TEST",
  ticketNumber: 7,
  currentUserID: "u-current",
  onmutated: vi.fn().mockResolvedValue(undefined),
};

describe("CommentThread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the empty state when there are no comments", async () => {
    const screen = render(CommentThread, { ...baseProps });
    await expect.element(screen.getByText("No comments yet.")).toBeVisible();
    await expect.element(screen.getByRole("heading", { name: "Comments" })).toBeVisible();
  });

  it("renders the body of every comment", async () => {
    const comments = [
      makeComment({ id: "c-1", body: "First post.", author: { id: "u-1", name: "Alice", avatarURL: null } }),
      makeComment({ id: "c-2", body: "Second post.", author: { id: "u-2", name: "Bob", avatarURL: null } }),
    ];
    const screen = render(CommentThread, { ...baseProps, comments });
    await expect.element(screen.getByText("First post.")).toBeVisible();
    await expect.element(screen.getByText("Second post.")).toBeVisible();
  });

  it("opens the composer when the Add a comment trigger is clicked", async () => {
    const screen = render(CommentThread, { ...baseProps });
    await screen.getByRole("button", { name: "Add a comment" }).click();
    await expect.element(screen.getByRole("heading", { name: "Add a comment" })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Comment" })).toBeDisabled();
  });

  it("renders a tombstone for deleted comments", async () => {
    const comments = [makeComment({ id: "c-dead", body: null, isDeleted: true, author: { id: "u-1", name: "Alice", avatarURL: null } })];
    const screen = render(CommentThread, { ...baseProps, comments });
    await expect.element(screen.getByText("Comment deleted.")).toBeVisible();
  });

  it("hides edit / delete actions for comments authored by other users", async () => {
    const comments = [makeComment({ id: "c-other", authorID: "u-other", body: "Hi", author: { id: "u-other", name: "Other", avatarURL: null } })];
    const screen = render(CommentThread, { ...baseProps, comments });
    expect(screen.getByRole("button", { name: "Edit" }).elements()).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Delete" }).elements()).toHaveLength(0);
  });

  it("shows edit / delete actions for the current user's comments", async () => {
    const comments = [makeComment({ id: "c-mine", authorID: "u-current", body: "Mine", author: { id: "u-current", name: "Me", avatarURL: null } })];
    const screen = render(CommentThread, { ...baseProps, comments });
    await expect.element(screen.getByRole("button", { name: "Edit" })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Delete" })).toBeVisible();
  });

  it("opens an inline editor when the user clicks Edit", async () => {
    const comments = [makeComment({ id: "c-mine", authorID: "u-current", body: "Mine", author: { id: "u-current", name: "Me", avatarURL: null } })];
    const screen = render(CommentThread, { ...baseProps, comments });
    await screen.getByRole("button", { name: "Edit" }).click();
    await expect.element(screen.getByRole("button", { name: "Save" })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Cancel" })).toBeVisible();
  });

  it("requires a confirm click before deleting", async () => {
    const comments = [makeComment({ id: "c-mine", authorID: "u-current", body: "Mine", author: { id: "u-current", name: "Me", avatarURL: null } })];
    const screen = render(CommentThread, { ...baseProps, comments });
    await screen.getByRole("button", { name: "Delete" }).click();
    await expect.element(screen.getByRole("button", { name: "Confirm delete" })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Cancel" })).toBeVisible();
  });
});
