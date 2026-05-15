import { describe, expect, it, vi } from "vitest";
import { IssuesApiError, type IssuesClient } from "../client.js";
import { handleGetProject, handleGetStats, handleListLabels, handleListMembers, handleListProjects, handleListStatuses } from "../tools/projects.js";
import { __testing as ticketsTesting, handleCloneTicket, handleCreateTicket, handleDeleteTicket, handleGetTicket, handleRestoreTicket, handleSearchTickets, handleUpdateTicket } from "../tools/tickets.js";
import { handleAddComment, handleDeleteComment, handleListComments, handleUpdateComment } from "../tools/comments.js";
import { handleListAttachments } from "../tools/attachments.js";
import { handleGetActivity, handleGetTicketActivity } from "../tools/activity.js";
import { handleAddLink, handleListLinks, handleRemoveLink } from "../tools/links.js";

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

describe("search_tickets handler", () => {
  it("forwards filters to the client and returns the response", async () => {
    const searchTickets = vi.fn().mockResolvedValue({ tickets: [] });
    const client = makeClient({ searchTickets });

    await handleSearchTickets(client, { project: "DASH", status: ["in-progress"], limit: 10 });

    expect(searchTickets).toHaveBeenCalledWith({ project: "DASH", status: ["in-progress"], limit: 10 });
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

  it("surfaces errors as isError content", async () => {
    const getTicket = vi.fn().mockRejectedValue(new IssuesApiError(404, "Ticket DASH-999 not found."));
    const client = makeClient({ getTicket });

    const result = await handleGetTicket(client, { ref: "DASH-999" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("Issues API 404: Ticket DASH-999 not found.");
  });
});

describe("create_ticket handler", () => {
  it("forwards the create args verbatim", async () => {
    const createTicket = vi.fn().mockResolvedValue({ ticket: { ref: "DASH-1", title: "x", status: "Backlog", priority: "medium", labels: [], updated: "2026-05-15" } });
    const client = makeClient({ createTicket });

    await handleCreateTicket(client, { project: "DASH", title: "x", labels: ["Bug"] });

    expect(createTicket).toHaveBeenCalledWith({ project: "DASH", title: "x", labels: ["Bug"] });
  });
});

describe("update_ticket handler", () => {
  it("splits ref from patch before calling the client", async () => {
    const patchTicket = vi.fn().mockResolvedValue({ ticket: { ref: "DASH-1", title: "x", status: "Backlog", priority: "high", labels: [], updated: "2026-05-15" } });
    const client = makeClient({ patchTicket });

    await handleUpdateTicket(client, { ref: "DASH-1", priority: "high", assignee: null });

    expect(patchTicket).toHaveBeenCalledWith("DASH-1", { priority: "high", assignee: null });
  });
});

describe("add_comment handler", () => {
  it("calls the client with ref and body", async () => {
    const addComment = vi.fn().mockResolvedValue({ commentID: "00000000-0000-0000-0000-000000000000" });
    const client = makeClient({ addComment });

    await handleAddComment(client, { ref: "DASH-1", body: "looks good" });

    expect(addComment).toHaveBeenCalledWith("DASH-1", "looks good");
  });
});

describe("list_comments handler", () => {
  it("returns the API payload as JSON", async () => {
    const listComments = vi.fn().mockResolvedValue({ comments: [] });
    const client = makeClient({ listComments });

    const result = await handleListComments(client, { ref: "DASH-1" });

    expect(listComments).toHaveBeenCalledWith("DASH-1");
    expect(JSON.parse(result.content[0].text)).toEqual({ comments: [] });
  });
});

describe("update_comment / delete_comment handlers", () => {
  it("update_comment calls updateComment with the id and body", async () => {
    const updateComment = vi.fn().mockResolvedValue({ commentID: "abc" });
    await handleUpdateComment(makeClient({ updateComment }), { id: "abc", body: "edited" });
    expect(updateComment).toHaveBeenCalledWith("abc", "edited");
  });

  it("delete_comment wraps the void response as { deleted: true }", async () => {
    const deleteComment = vi.fn().mockResolvedValue(undefined);
    const result = await handleDeleteComment(makeClient({ deleteComment }), { id: "abc" });
    expect(deleteComment).toHaveBeenCalledWith("abc");
    expect(JSON.parse(result.content[0].text)).toEqual({ deleted: true });
  });
});

describe("list_attachments handler", () => {
  it("forwards the ref", async () => {
    const listAttachments = vi.fn().mockResolvedValue({ attachments: [] });
    await handleListAttachments(makeClient({ listAttachments }), { ref: "DASH-1" });
    expect(listAttachments).toHaveBeenCalledWith("DASH-1");
  });
});

describe("get_activity handler", () => {
  it("passes project and limit to the client", async () => {
    const getActivity = vi.fn().mockResolvedValue({ activity: [] });
    const client = makeClient({ getActivity });

    await handleGetActivity(client, { project: "DASH", limit: 50 });

    expect(getActivity).toHaveBeenCalledWith("DASH", 50);
  });
});

describe("get_ticket_activity handler", () => {
  it("forwards the ref to the client", async () => {
    const getTicketActivity = vi.fn().mockResolvedValue({ activity: [] });
    const client = makeClient({ getTicketActivity });

    await handleGetTicketActivity(client, { ref: "DASH-12" });

    expect(getTicketActivity).toHaveBeenCalledWith("DASH-12");
  });
});

describe("get_project handler", () => {
  it("returns the project detail payload", async () => {
    const getProject = vi.fn().mockResolvedValue({ project: { key: "DASH", name: "Dashboard", description: null, members: [], statuses: [], labels: [] } });
    const client = makeClient({ getProject });

    const result = await handleGetProject(client, { key: "DASH" });

    expect(getProject).toHaveBeenCalledWith("DASH");
    expect(JSON.parse(result.content[0].text).project.key).toBe("DASH");
  });
});

describe("project micro tools", () => {
  it("list_members calls listMembers", async () => {
    const listMembers = vi.fn().mockResolvedValue({ members: [] });
    await handleListMembers(makeClient({ listMembers }), { key: "DASH" });
    expect(listMembers).toHaveBeenCalledWith("DASH");
  });

  it("list_statuses calls listStatuses", async () => {
    const listStatuses = vi.fn().mockResolvedValue({ statuses: [] });
    await handleListStatuses(makeClient({ listStatuses }), { key: "DASH" });
    expect(listStatuses).toHaveBeenCalledWith("DASH");
  });

  it("list_labels calls listLabels", async () => {
    const listLabels = vi.fn().mockResolvedValue({ labels: [] });
    await handleListLabels(makeClient({ listLabels }), { key: "DASH" });
    expect(listLabels).toHaveBeenCalledWith("DASH");
  });

  it("get_stats calls getStats", async () => {
    const getStats = vi.fn().mockResolvedValue({ stats: { total: 0, open: 0, closed: 0, lastActivityAt: null, byMember: {} } });
    await handleGetStats(makeClient({ getStats }), { key: "DASH" });
    expect(getStats).toHaveBeenCalledWith("DASH");
  });
});

describe("ticket lifecycle handlers", () => {
  it("delete_ticket calls softDeleteTicket", async () => {
    const softDeleteTicket = vi.fn().mockResolvedValue({ ref: "DASH-1" });
    await handleDeleteTicket(makeClient({ softDeleteTicket }), { ref: "DASH-1" });
    expect(softDeleteTicket).toHaveBeenCalledWith("DASH-1");
  });

  it("restore_ticket calls restoreTicket", async () => {
    const restoreTicket = vi.fn().mockResolvedValue({ ticket: { ref: "DASH-1", title: "x", status: "Backlog", priority: "medium", labels: [], updated: "2026-05-15" } });
    await handleRestoreTicket(makeClient({ restoreTicket }), { ref: "DASH-1" });
    expect(restoreTicket).toHaveBeenCalledWith("DASH-1");
  });

  it("clone_ticket splits ref from overrides", async () => {
    const cloneTicket = vi.fn().mockResolvedValue({ ticket: { ref: "DASH-2", title: "Clone", status: "Backlog", priority: "medium", labels: [], updated: "2026-05-15" } });
    await handleCloneTicket(makeClient({ cloneTicket }), { ref: "DASH-1", title: "Clone", copyAttachments: true });
    expect(cloneTicket).toHaveBeenCalledWith("DASH-1", { title: "Clone", copyAttachments: true });
  });
});

describe("link handlers", () => {
  it("list_links forwards the ref", async () => {
    const listLinks = vi.fn().mockResolvedValue({ links: [] });
    await handleListLinks(makeClient({ listLinks }), { ref: "DASH-1" });
    expect(listLinks).toHaveBeenCalledWith("DASH-1");
  });

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
