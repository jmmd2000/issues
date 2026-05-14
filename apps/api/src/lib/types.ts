import { db } from "../db";
import { attachments, comments, labels, projectMembers, projects, statuses, ticketActivity, ticketCounters, ticketLabels, ticketLinks, tickets, users } from "../db/schema";
import { ACTIVITY_ACTIONS, LINK_TYPES, PRIORITIES, SEARCH_SORT_COLUMNS, SEARCH_SORT_DIRECTIONS, STATUS_CATEGORIES } from "./constants";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type StatusCategory = (typeof STATUS_CATEGORIES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type SearchSortColumn = (typeof SEARCH_SORT_COLUMNS)[number];
export type SearchSortDirection = (typeof SEARCH_SORT_DIRECTIONS)[number];
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];
export type LinkType = (typeof LINK_TYPES)[number];

export type Jsonified<T> = T extends Date ? string : T extends (infer U)[] ? Jsonified<U>[] : T extends object ? { [K in keyof T]: Jsonified<T[K]> } : T;

export type UserRow = typeof users.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type ProjectMemberRow = typeof projectMembers.$inferSelect;
export type StatusRow = typeof statuses.$inferSelect;
export type LabelRow = typeof labels.$inferSelect;
export type TicketRow = typeof tickets.$inferSelect;
export type TicketCounterRow = typeof ticketCounters.$inferSelect;
export type TicketLabelRow = typeof ticketLabels.$inferSelect;

export type ActivityInsert = typeof ticketActivity.$inferInsert;
export type ActivityRow = typeof ticketActivity.$inferSelect;
export type CommentRow = typeof comments.$inferSelect;
export type TicketLinkRow = typeof ticketLinks.$inferSelect;
export type AttachmentRow = typeof attachments.$inferSelect;

export type Visibility = "public" | "private";

export type User = Jsonified<UserRow>;
export type Project = Jsonified<ProjectRow>;
export type CurrentUser = Jsonified<Pick<UserRow, "id" | "name" | "email" | "avatarURL" | "createdAt">>;
export type Status = Jsonified<StatusRow>;
export type Label = Jsonified<LabelRow>;
export type Ticket = Jsonified<TicketRow>;

export type ProjectMemberUser = Jsonified<Pick<UserRow, "id" | "name" | "avatarURL" | "createdAt" | "updatedAt">>;
export type ProjectMember = Jsonified<Omit<ProjectMemberRow, "projectID">> & { user: ProjectMemberUser };

export type ProjectDetail = Project & {
  statuses: Status[];
  labels: Label[];
  members: ProjectMember[];
};

export type TicketUser = Jsonified<Pick<UserRow, "id" | "name" | "avatarURL">>;

export type Comment = Jsonified<Pick<CommentRow, "id" | "ticketID" | "authorID" | "createdAt" | "editedAt">> & {
  body: string | null;
  isDeleted: boolean;
  author: TicketUser;
};

export type TicketActivity = Jsonified<Pick<ActivityRow, "id" | "ticketID" | "userID" | "fieldName" | "oldValue" | "newValue" | "createdAt">> & {
  action: ActivityAction;
  user: TicketUser;
};

export type ProjectActivity = TicketActivity & {
  ticket: { id: string; number: number; title: string };
};

export type LinkedTicketRef = {
  id: string;
  number: number;
  title: string;
  projectKey: string;
  status: { name: string; category: StatusCategory };
  priority: Priority;
  assignee: TicketUser | null;
};

export type TicketLink = {
  id: string;
  linkType: LinkType;
  /**
   * Logical direction relative to the ticket whose detail page is being viewed.
   * Outgoing means the viewing ticket is the source (uses the canonical link
   * type label). Incoming means the viewing ticket is the target (the renderer
   * should pick the inverse label).
   */
  direction: "outgoing" | "incoming";
  /** The ticket on the other side of the link relative to the viewer. */
  ticket: LinkedTicketRef;
  createdAt: string;
};

export type MemberStats = {
  assignedOpen: number;
  assignedTotal: number;
  reported: number;
};

export type ProjectStats = {
  totalTickets: number;
  openTickets: number;
  closedTickets: number;
  lastActivityAt: string | null;
  byMember: Record<string, MemberStats>;
};

export type Attachment = Jsonified<
  Pick<AttachmentRow, "id" | "ticketID" | "commentID" | "uploaderID" | "filename" | "storageKey" | "contentHash" | "sizeBytes" | "width" | "height" | "mimeType" | "isImage" | "createdAt">
> & {
  url: string;
  uploader: TicketUser;
};

export type TicketSummary = Jsonified<Pick<TicketRow, "id" | "number" | "title" | "priority" | "position" | "statusID" | "createdAt" | "updatedAt">> & {
  labels: Label[];
  assignee: TicketUser | null;
};

export type TicketChild = Jsonified<Pick<TicketRow, "id" | "number" | "title" | "priority" | "statusID">> & {
  status: { id: string; name: string; category: StatusCategory };
  assignee: TicketUser | null;
};

export type TicketDetail = Ticket & {
  status: Status;
  labels: Label[];
  reporter: TicketUser;
  assignee: TicketUser | null;
  parent: Pick<Ticket, "id" | "number" | "title"> | null;
  children: TicketChild[];
};

export type SearchHighlightPart = {
  text: string;
  highlighted: boolean;
};

export type SearchResult = Jsonified<Pick<TicketRow, "id" | "number" | "title" | "description" | "priority" | "visibility" | "createdAt" | "updatedAt">> & {
  project: Jsonified<Pick<ProjectRow, "id" | "key" | "name" | "visibility">>;
  status: Jsonified<Pick<StatusRow, "id" | "name" | "slug" | "category">>;
  assignee: TicketUser | null;
  labels: Jsonified<Pick<LabelRow, "id" | "name" | "colour">>[];
  highlights: {
    title: SearchHighlightPart[];
    description: SearchHighlightPart[];
  };
};

export type SearchFilterOptions = {
  projects: Jsonified<Pick<ProjectRow, "id" | "key" | "name" | "visibility">>[];
  statuses: Jsonified<Pick<StatusRow, "slug" | "name" | "category">>[];
  labels: Jsonified<Pick<LabelRow, "name" | "colour">>[];
  assignees: TicketUser[];
};

export type TicketFieldRef = { id: string; name: string };
export type TicketSnapshot = {
  id: string;
  number: number;
  title: string;
  description: string;
  priority: Priority;
  visibility: Visibility;
  status: TicketFieldRef;
  reporter: TicketFieldRef;
  assignee: TicketFieldRef | null;
  parent: TicketFieldRef | null;
  labels: TicketFieldRef[];
};

export type ActivityValue = {
  value?: string; // value fields
  id?: string; // any referenced entity (status/assignee/label/comment/attachment)
  name?: string; // frozen name
  body?: string; // comment_edited before/after
  excerpt?: string; // comment_added/deleted body preview
  number?: number; // link_added/removed partner ticket number
  title?: string; // link_added/removed partner ticket title
  ticketID?: string; // link_added/removed partner ticket id
  projectKey?: string; // link_added/removed partner ticket project key
  direction?: "outgoing" | "incoming"; // link_added/removed direction relative to the side this row lives on
  filename?: string; // attachment_added/removed
};
