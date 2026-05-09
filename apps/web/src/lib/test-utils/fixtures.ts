import type { Comment, Label, ProjectActivity, ProjectDetail, ProjectMember, ProjectStats, Status, TicketActivity, TicketLink } from "@issues/api";

const baseDate = "2026-05-01T10:00:00.000Z";

export function makeStatus(overrides: Partial<Status> = {}): Status {
  return {
    id: "00000000-0000-0000-0000-0000000000s1",
    projectID: "00000000-0000-0000-0000-0000000000p1",
    name: "Backlog",
    slug: "backlog",
    position: 10,
    category: "backlog",
    createdAt: baseDate,
    ...overrides,
  };
}

export function makeLabel(overrides: Partial<Label> = {}): Label {
  return {
    id: "00000000-0000-0000-0000-0000000000l1",
    projectID: "00000000-0000-0000-0000-0000000000p1",
    name: "bug",
    colour: "#ff5555",
    ...overrides,
  };
}

export function makeMember(overrides: Partial<ProjectMember> = {}): ProjectMember {
  return {
    userID: "00000000-0000-0000-0000-0000000000u1",
    role: "member",
    joinedAt: baseDate,
    user: {
      id: "00000000-0000-0000-0000-0000000000u1",
      name: "Alex Member",
      avatarURL: null,
      createdAt: baseDate,
      updatedAt: baseDate,
    },
    ...overrides,
  };
}

export function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: "00000000-0000-0000-0000-0000000000c1",
    ticketID: "00000000-0000-0000-0000-0000000000t1",
    authorID: "00000000-0000-0000-0000-0000000000u1",
    body: "Looks good to me.",
    isDeleted: false,
    createdAt: baseDate,
    editedAt: null,
    author: {
      id: "00000000-0000-0000-0000-0000000000u1",
      name: "Alex Member",
      avatarURL: null,
    },
    ...overrides,
  };
}

export function makeActivity(overrides: Partial<TicketActivity> = {}): TicketActivity {
  return {
    id: "00000000-0000-0000-0000-0000000000a1",
    ticketID: "00000000-0000-0000-0000-0000000000t1",
    userID: "00000000-0000-0000-0000-0000000000u1",
    action: "created",
    fieldName: null,
    oldValue: null,
    newValue: { value: "Initial ticket" },
    createdAt: baseDate,
    user: {
      id: "00000000-0000-0000-0000-0000000000u1",
      name: "Alex Member",
      avatarURL: null,
    },
    ...overrides,
  };
}

export function makeProjectActivity(overrides: Partial<ProjectActivity> = {}): ProjectActivity {
  return {
    ...makeActivity(),
    ticket: { id: "00000000-0000-0000-0000-0000000000t1", number: 1, title: "Initial ticket" },
    ...overrides,
  };
}

export function makeProjectDetail(overrides: Partial<ProjectDetail> = {}): ProjectDetail {
  const owner = makeMember({
    userID: "00000000-0000-0000-0000-0000000000u0",
    role: "owner",
    user: { id: "00000000-0000-0000-0000-0000000000u0", name: "Olivia Owner", avatarURL: null, createdAt: baseDate, updatedAt: baseDate },
  });
  return {
    id: "00000000-0000-0000-0000-0000000000p1",
    key: "TEST",
    name: "Test Project",
    description: "A test project",
    repo: null,
    stack: [],
    metadata: {},
    visibility: "public",
    ownerID: owner.userID,
    createdAt: baseDate,
    updatedAt: baseDate,
    statuses: [makeStatus()],
    labels: [makeLabel()],
    members: [owner],
    ...overrides,
  };
}

export function makeProjectStats(overrides: Partial<ProjectStats> = {}): ProjectStats {
  return {
    totalTickets: 0,
    openTickets: 0,
    closedTickets: 0,
    lastActivityAt: null,
    byMember: {},
    ...overrides,
  };
}

export function makeTicketLink(overrides: Partial<TicketLink> = {}): TicketLink {
  return {
    id: "00000000-0000-0000-0000-00000000lnk1",
    linkType: "blocks",
    direction: "outgoing",
    ticket: {
      id: "00000000-0000-0000-0000-0000000000t2",
      number: 2,
      title: "Other ticket",
      projectKey: "TEST",
      status: { name: "Backlog", category: "backlog" },
      priority: "medium",
      assignee: null,
    },
    createdAt: baseDate,
    ...overrides,
  };
}
