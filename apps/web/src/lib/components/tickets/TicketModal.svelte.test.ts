import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "vitest-browser-svelte";
import { makeLabel, makeMember, makeStatus } from "$lib/test-utils/fixtures";
import { mockResponse } from "$lib/test-utils/mockClient";

vi.mock("$lib/api/client", async () => {
  const { createMockClient } = await import("$lib/test-utils/mockClient");
  const client = createMockClient();
  return { client, createClient: () => client };
});

vi.mock("$app/navigation", () => ({
  goto: vi.fn(),
  invalidateAll: vi.fn().mockResolvedValue(undefined),
}));

import { client } from "$lib/api/client";
import TicketModal from "./TicketModal.svelte";

const createdTicket = { ticket: { id: "t-1", number: 1, title: "New ticket" } };

const baseProps = {
  open: true,
  mode: "create" as const,
  projectKey: "TEST",
  statuses: [makeStatus()],
  labels: [makeLabel()],
  members: [makeMember()],
  currentUserID: "u-1",
  onSuccess: "stay" as const,
  onclose: () => {},
};

async function submitNewTicket(projectVisibility: "public" | "private") {
  const post = vi.mocked(client.api.projects[":key"].tickets.$post);
  post.mockResolvedValueOnce(mockResponse(createdTicket, true, 201) as unknown as Awaited<ReturnType<typeof post>>);
  const screen = await render(TicketModal, { ...baseProps, projectVisibility });
  await screen.getByLabelText("Title").fill("New ticket");
  await screen.getByRole("button", { name: "Create ticket" }).click();
  return { screen, post };
}

describe("TicketModal visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the chosen visibility in a public project", async () => {
    const { screen, post } = await submitNewTicket("public");

    await expect.element(screen.getByRole("radiogroup", { name: "Visibility" })).toBeInTheDocument();
    expect(post).toHaveBeenCalledOnce();
    expect(post.mock.calls[0][0].json).toMatchObject({ visibility: "public" });
  });

  it("hides the toggle and leaves visibility out of the request in a private project", async () => {
    const { screen, post } = await submitNewTicket("private");

    expect(screen.getByRole("radiogroup", { name: "Visibility" }).elements()).toHaveLength(0);
    expect(post).toHaveBeenCalledOnce();
    expect(post.mock.calls[0][0].json.visibility).toBeUndefined();
  });
});
