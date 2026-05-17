import type {
  CompactActivity,
  CompactAttachment,
  CompactComment,
  CompactLabel,
  CompactLink,
  CompactMember,
  CompactProject,
  CompactProjectDetail,
  CompactSearchPage,
  CompactStats,
  CompactStatus,
  CompactTicket,
  CompactTicketDetail,
  LinkType,
  Priority,
} from "@issues/shared";

export type SortColumn = "relevance" | "updatedAt" | "createdAt" | "title";
export type SortDirection = "asc" | "desc";

export type SearchArgs = {
  q?: string;
  project?: string;
  status?: string[];
  priority?: Priority[];
  label?: string[];
  assignee?: string[];
  page?: number;
  perPage?: number;
  sortBy?: SortColumn;
  sortDirection?: SortDirection;
};

export type CreateTicketArgs = {
  project: string;
  title: string;
  description?: string;
  statusSlug?: string;
  priority?: Priority;
  labels?: string[];
  assignee?: string | null;
  parentTicketRef?: string | null;
};

export type PatchTicketArgs = {
  title?: string;
  description?: string;
  statusSlug?: string;
  priority?: Priority;
  labels?: string[];
  addLabels?: string[];
  removeLabels?: string[];
  assignee?: string | null;
  parentTicketRef?: string | null;
};

export type CloneTicketArgs = {
  title: string;
  description?: string;
  statusSlug?: string;
  priority?: Priority;
  labels?: string[];
  assignee?: string | null;
  copyAttachments?: boolean;
};

export type LinkArgs = {
  target: string;
  linkType: LinkType;
};

/**
 * Thrown when the API returns a non-2xx response. The MCP tool handler catches
 * this and surfaces the message to the model so it can adjust its next call.
 */
export class IssuesApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "IssuesApiError";
  }
}

/**
 * Thin HTTP wrapper around the compact `/api/mcp/*` endpoints. Every request
 * carries the bearer token from the environment; failures throw
 * {@link IssuesApiError} with the API's error message intact.
 */
export class IssuesClient {
  constructor(private readonly apiURL: string, private readonly apiToken: string) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.apiToken}`);
    if (init.body !== undefined) headers.set("Content-Type", "application/json");

    const res = await fetch(`${this.apiURL}${path}`, { ...init, headers });

    if (!res.ok) {
      const text = await res.text();
      let message = text;
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed?.message === "string") message = parsed.message;
      } catch {
        // fall through with raw text
      }
      throw new IssuesApiError(res.status, message || `Issues API ${res.status}`);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  // -- projects --

  listProjects() {
    return this.request<{ projects: CompactProject[] }>("/api/mcp/projects");
  }

  getProject(key: string) {
    return this.request<{ project: CompactProjectDetail }>(`/api/mcp/projects/${encodeURIComponent(key)}`);
  }

  listMembers(key: string) {
    return this.request<{ members: CompactMember[] }>(`/api/mcp/projects/${encodeURIComponent(key)}/members`);
  }

  listStatuses(key: string) {
    return this.request<{ statuses: CompactStatus[] }>(`/api/mcp/projects/${encodeURIComponent(key)}/statuses`);
  }

  listLabels(key: string) {
    return this.request<{ labels: CompactLabel[] }>(`/api/mcp/projects/${encodeURIComponent(key)}/labels`);
  }

  getStats(key: string) {
    return this.request<{ stats: CompactStats }>(`/api/mcp/projects/${encodeURIComponent(key)}/stats`);
  }

  // -- tickets --

  searchTickets(args: SearchArgs) {
    const params = new URLSearchParams();
    if (args.q) params.set("q", args.q);
    if (args.project) params.set("project", args.project);
    for (const slug of args.status ?? []) params.append("status", slug);
    for (const priority of args.priority ?? []) params.append("priority", priority);
    for (const name of args.label ?? []) params.append("label", name);
    for (const name of args.assignee ?? []) params.append("assignee", name);
    if (args.page !== undefined) params.set("page", String(args.page));
    if (args.perPage !== undefined) params.set("perPage", String(args.perPage));
    if (args.sortBy) params.set("sortBy", args.sortBy);
    if (args.sortDirection) params.set("sortDirection", args.sortDirection);
    const query = params.toString();
    return this.request<CompactSearchPage>(`/api/mcp/tickets${query ? `?${query}` : ""}`);
  }

  getTicket(ref: string, opts: { full?: boolean } = {}) {
    const params = new URLSearchParams();
    if (opts.full) params.set("full", "true");
    const query = params.toString();
    return this.request<{ ticket: CompactTicketDetail }>(`/api/mcp/tickets/${encodeURIComponent(ref)}${query ? `?${query}` : ""}`);
  }

  createTicket(args: CreateTicketArgs) {
    return this.request<{ ticket: CompactTicket }>("/api/mcp/tickets", { method: "POST", body: JSON.stringify(args) });
  }

  patchTicket(ref: string, patch: PatchTicketArgs) {
    return this.request<{ ticket: CompactTicket }>(`/api/mcp/tickets/${encodeURIComponent(ref)}`, { method: "PATCH", body: JSON.stringify(patch) });
  }

  softDeleteTicket(ref: string) {
    return this.request<{ ref: string }>(`/api/mcp/tickets/${encodeURIComponent(ref)}`, { method: "DELETE" });
  }

  restoreTicket(ref: string) {
    return this.request<{ ticket: CompactTicket }>(`/api/mcp/tickets/${encodeURIComponent(ref)}/restore`, { method: "POST" });
  }

  cloneTicket(ref: string, args: CloneTicketArgs) {
    return this.request<{ ticket: CompactTicket }>(`/api/mcp/tickets/${encodeURIComponent(ref)}/clone`, { method: "POST", body: JSON.stringify(args) });
  }

  // -- comments --

  addComment(ref: string, body: string) {
    return this.request<{ commentID: string }>(`/api/mcp/tickets/${encodeURIComponent(ref)}/comments`, { method: "POST", body: JSON.stringify({ body }) });
  }

  listComments(ref: string) {
    return this.request<{ comments: CompactComment[] }>(`/api/mcp/tickets/${encodeURIComponent(ref)}/comments`);
  }

  updateComment(id: string, body: string) {
    return this.request<{ commentID: string }>(`/api/mcp/comments/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ body }) });
  }

  deleteComment(id: string) {
    return this.request<void>(`/api/mcp/comments/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  // -- attachments --

  listAttachments(ref: string) {
    return this.request<{ attachments: CompactAttachment[] }>(`/api/mcp/tickets/${encodeURIComponent(ref)}/attachments`);
  }

  // -- activity --

  getActivity(project: string, limit?: number) {
    const params = new URLSearchParams({ project });
    if (limit !== undefined) params.set("limit", String(limit));
    return this.request<{ activity: CompactActivity[] }>(`/api/mcp/activity?${params.toString()}`);
  }

  getTicketActivity(ref: string) {
    return this.request<{ activity: CompactActivity[] }>(`/api/mcp/tickets/${encodeURIComponent(ref)}/activity`);
  }

  // -- links --

  listLinks(ref: string) {
    return this.request<{ links: CompactLink[] }>(`/api/mcp/tickets/${encodeURIComponent(ref)}/links`);
  }

  addLink(ref: string, args: LinkArgs) {
    return this.request<{ link: CompactLink }>(`/api/mcp/tickets/${encodeURIComponent(ref)}/links`, { method: "POST", body: JSON.stringify(args) });
  }

  removeLink(ref: string, args: LinkArgs) {
    const params = new URLSearchParams({ target: args.target, linkType: args.linkType });
    return this.request<void>(`/api/mcp/tickets/${encodeURIComponent(ref)}/links?${params.toString()}`, { method: "DELETE" });
  }
}
