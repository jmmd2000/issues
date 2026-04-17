import { db } from "../db";
import { labels, projectMembers, projects, STATUS_CATEGORIES, statuses, ticketCounters, ticketLabels, tickets, users } from "../db/schema";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type StatusCategory = (typeof STATUS_CATEGORIES)[number];

export type Jsonified<T> = T extends Date ? string : T extends (infer U)[] ? Jsonified<U>[] : T extends object ? { [K in keyof T]: Jsonified<T[K]> } : T;

export type UserRow = typeof users.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type ProjectMemberRow = typeof projectMembers.$inferSelect;
export type StatusRow = typeof statuses.$inferSelect;
export type LabelRow = typeof labels.$inferSelect;
export type TicketRow = typeof tickets.$inferSelect;
export type TicketCounterRow = typeof ticketCounters.$inferSelect;
export type TicketLabelRow = typeof ticketLabels.$inferSelect;

export type User = Jsonified<UserRow>;
export type Project = Jsonified<ProjectRow>;
export type CurrentUser = Jsonified<Pick<UserRow, "name" | "email" | "avatarURL" | "createdAt">>;
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

export type TicketSummary = Jsonified<Pick<TicketRow, "id" | "number" | "title" | "priority" | "position" | "statusID" | "createdAt" | "updatedAt">> & {
  labels: Label[];
  assignee: TicketUser | null;
};

export type TicketDetail = Ticket & {
  status: Status;
  labels: Label[];
  reporter: TicketUser;
  assignee: TicketUser | null;
  parent: Pick<Ticket, "id" | "number" | "title"> | null;
};
