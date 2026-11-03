import { describe, expect, it, vi } from "vitest";
import { IssuesApiError, type IssuesClient } from "../client.js";
import { handleListProjects } from "../tools/projects.js";
import { __testing as ticketsTesting, handleCloneTicket, handleGetTicket, handleUpdateTicket } from "../tools/tickets.js";
import { handleDeleteComment } from "../tools/comments.js";
import { handleAddLink, handleRemoveLink } from "../tools/links.js";

function makeClient(overrides: Partial<IssuesClient>): IssuesClient {
  return overrides as unknown as IssuesClient;
}

describe("list_projects handler", () => {
  it("returns the API payload as JSON content", async () => {
    const listProjects = vi.fn().mockResolvedValue({ projects: [{ key: "DASH", name: "Dashboard" }] });
    const client = makeClient({ listProjects });

    const result = await handleListProjects(client);

    expect(listProjects).toHaveBeenCalledOnce();
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual({ projects: [{ key: "DASH", name: "Dashboard" }] });
  });

  it("surfaces IssuesApiError messages as isError content", async () => {
    const listProjects = vi.fn().mockRejectedValue(new IssuesApiError(401, "Invalid or expired token."));
    const client = makeClient({ listProjects });

    const result = await handleListProjects(client);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("Issues API 401: Invalid or expired token.");
  });
});

describe("get_ticket handler", () => {
  it("renders the response as markdown", async () => {
    const getTicket = vi.fn().mockResolvedValue({
      ticket: {
        ref: "DASH-12",
        title: "Add login form",
        status: "In Progress",
        priority: "high",
        labels: ["Bug"],
        updated: "2026-05-15",
        description: "Build it.",
        assignee: "James",
        reporter: "James",
      },
    });
    const client = makeClient({ getTicket });

    const result = await handleGetTicket(client, { ref: "DASH-12" });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("# DASH-12  Add login form");
    expect(result.content[0].text).toContain("Status: In Progress");
    expect(result.content[0].text).toContain("Labels: Bug");
    expect(result.content[0].text).toContain("Build it.");
  });

  it("renders (unassigned) when assignee is null", async () => {
    const detail = {
      ref: "DASH-1",
      title: "x",
      status: "Backlog",
      priority: "medium" as const,
      labels: [],
      updated: "2026-05-15",
      description: "",
      assignee: null,
      reporter: "James",
    };
    const rendered = ticketsTesting.renderTicketDetail(detail);
    expect(rendered).toContain("Assignee: (unassigned)");
    expect(rendered).toContain("Labels: (none)");
    expect(rendered).toContain("(no description)");
  });

  it("renders the parent ref, or (none) when there is no parent", () => {
    const detail = {
      ref: "DASH-2",
      title: "x",
      status: "Backlog",
      priority: "medium" as const,
      labels: [],
      created: "2026-05-15",
      updated: "2026-05-15",
      description: "",
      descriptionTruncated: false,
      assignee: null,
      reporter: "James",
    };

    expect(ticketsTesting.renderTicketDetail({ ...detail, parentTicketRef: "DASH-1" })).toContain("Parent: DASH-1");
    expect(ticketsTesting.renderTicketDetail({ ...detail, parentTicketRef: null })).toContain("Parent: (none)");
  });

  it("surfaces errors as isError content", async () => {
    const getTicket = vi.fn().mockRejectedValue(new IssuesApiError(404, "Ticket DASH-999 not found."));
    const client = makeClient({ getTicket });

    const result = await handleGetTicket(client, { ref: "DASH-999" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("Issues API 404: Ticket DASH-999 not found.");
  });
});

describe("update_ticket handler", () => {
  it("splits ref from patch before calling the client", async () => {
    const patchTicket = vi.fn().mockResolvedValue({ ticket: { ref: "DASH-1", title: "x", status: "Backlog", priority: "high", labels: [], updated: "2026-05-15" } });
    const client = makeClient({ patchTicket });

    await handleUpdateTicket(client, { ref: "DASH-1", priority: "high", assignee: null });

    expect(patchTicket).toHaveBeenCalledWith("DASH-1", { priority: "high", assignee: null });
  });

  it("forwards parentTicketRef: null to clear the parent", async () => {
    const patchTicket = vi.fn().mockResolvedValue({ ticket: { ref: "DASH-2", title: "x", status: "Backlog", priority: "medium", labels: [], updated: "2026-05-15" } });
    const client = makeClient({ patchTicket });

    await handleUpdateTicket(client, { ref: "DASH-2", parentTicketRef: null });

    expect(patchTicket).toHaveBeenCalledWith("DASH-2", { parentTicketRef: null });
  });
});

describe("update_comment / delete_comment handlers", () => {
  it("delete_comment wraps the void response as { deleted: true }", async () => {
    const deleteComment = vi.fn().mockResolvedValue(undefined);
    const result = await handleDeleteComment(makeClient({ deleteComment }), { id: "abc" });
    expect(deleteComment).toHaveBeenCalledWith("abc");
    expect(JSON.parse(result.content[0].text)).toEqual({ deleted: true });
  });
});

describe("ticket lifecycle handlers", () => {
  it("clone_ticket splits ref from overrides", async () => {
    const cloneTicket = vi.fn().mockResolvedValue({ ticket: { ref: "DASH-2", title: "Clone", status: "Backlog", priority: "medium", labels: [], updated: "2026-05-15" } });
    await handleCloneTicket(makeClient({ cloneTicket }), { ref: "DASH-1", title: "Clone", copyAttachments: true });
    expect(cloneTicket).toHaveBeenCalledWith("DASH-1", { title: "Clone", copyAttachments: true });
  });
});

describe("link handlers", () => {
  it("add_link splits ref from the body", async () => {
    const addLink = vi.fn().mockResolvedValue({ link: { ref: "DASH-2", title: "x", status: "Backlog", linkType: "blocks", direction: "outgoing" } });
    await handleAddLink(makeClient({ addLink }), { ref: "DASH-1", target: "DASH-2", linkType: "blocks" });
    expect(addLink).toHaveBeenCalledWith("DASH-1", { target: "DASH-2", linkType: "blocks" });
  });

  it("remove_link wraps the void response so MCP gets readable content", async () => {
    const removeLink = vi.fn().mockResolvedValue(undefined);
    const result = await handleRemoveLink(makeClient({ removeLink }), { ref: "DASH-1", target: "DASH-2", linkType: "blocks" });
    expect(removeLink).toHaveBeenCalledWith("DASH-1", { target: "DASH-2", linkType: "blocks" });
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual({ removed: true });
  });
});
