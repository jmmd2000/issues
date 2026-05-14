import { relations, sql } from "drizzle-orm";
import { boolean, pgEnum, pgTable, uuid, text, timestamp, jsonb, integer, primaryKey, unique, index, check, varchar, type AnyPgColumn } from "drizzle-orm/pg-core";
import { ACTIVITY_ACTIONS, LINK_TYPES, PRIORITIES, STATUS_CATEGORIES } from "../lib/constants";
import type { ActivityValue } from "../lib/types";
import { tsvector } from "./types";

export const statusCategoryEnum = pgEnum("status_category", STATUS_CATEGORIES);
export const priorityEnum = pgEnum("priority", PRIORITIES);
export const activityActionEnum = pgEnum("activity_action", ACTIVITY_ACTIONS);
export const linkTypeEnum = pgEnum("link_type", LINK_TYPES);

export const safeUserColumns = {
  id: true,
  name: true,
  email: true,
  avatarURL: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  avatarURL: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// prettier-ignore
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userID: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// prettier-ignore
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  repo: text("repo"),
  stack: text("stack").array().notNull().default([]),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  visibility: text("visibility", { enum: ["public", "private"] }).notNull().default("public"),
  ownerID: uuid("owner_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
},
  (table) => [index("idx_projects_key").on(table.key)]
);

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, { fields: [projects.ownerID], references: [users.id] }),
  members: many(projectMembers),
  statuses: many(statuses),
  labels: many(labels),
}));

// prettier-ignore
export const projectMembers = pgTable("project_members", {
  projectID: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userID: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["owner", "member"] }).notNull().default("member"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
},
  (table) => [primaryKey({ columns: [table.projectID, table.userID] })]
);

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, { fields: [projectMembers.projectID], references: [projects.id] }),
  user: one(users, { fields: [projectMembers.userID], references: [users.id] }),
}));

// prettier-ignore
export const statuses = pgTable("statuses", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectID: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  position: integer("position").notNull(),
  category: statusCategoryEnum("category").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
},
  (table) => [unique("uq_statuses_project_slug").on(table.projectID, table.slug)]
);

export const statusesRelations = relations(statuses, ({ one }) => ({
  project: one(projects, { fields: [statuses.projectID], references: [projects.id] }),
}));

// prettier-ignore
export const labels = pgTable("labels", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectID: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  colour: text("colour").notNull().default("#00ff00"),
},
  (table) => [unique("uq_labels_project_name").on(table.projectID, table.name)]
);

export const labelsRelations = relations(labels, ({ one }) => ({
  project: one(projects, { fields: [labels.projectID], references: [projects.id] }),
}));

export const tickets = pgTable(
  "tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectID: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description").notNull().default(""),
    descriptionSearch: tsvector("description_search").generatedAlwaysAs(
      sql`to_tsvector('english', title || ' ' || coalesce(description, ''))`
    ),
    statusID: uuid("status_id")
      .notNull()
      .references(() => statuses.id),
    priority: priorityEnum("priority").notNull().default("medium"),
    visibility: text("visibility", { enum: ["public", "private"] })
      .notNull()
      .default("public"),
    position: text("position").notNull(),
    parentTicketID: uuid("parent_ticket_id").references((): AnyPgColumn => tickets.id, { onDelete: "set null" }),
    reporterID: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    assigneeID: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("uq_tickets_project_number").on(table.projectID, table.number),
    index("idx_tickets_project_active")
      .on(table.projectID)
      .where(sql`${table.deletedAt} IS NULL`),
    index("idx_tickets_kanban")
      .on(table.projectID, table.statusID, table.position)
      .where(sql`${table.deletedAt} IS NULL`),
    index("idx_tickets_assignee")
      .on(table.assigneeID)
      .where(sql`${table.deletedAt} IS NULL`),
    index("idx_tickets_parent").on(table.parentTicketID),
    index("idx_tickets_project_number").on(table.projectID, table.number),
    index("idx_tickets_visibility")
      .on(table.projectID)
      .where(sql`${table.visibility} = 'private'`),
    index("idx_tickets_project_trash")
      .on(table.projectID, table.deletedAt)
      .where(sql`${table.deletedAt} IS NOT NULL`),
    index("idx_tickets_search").using("gin", table.descriptionSearch),
    check("ck_tickets_title_nonempty", sql`length(trim(${table.title})) > 0`),
  ]
);

export const ticketCounters = pgTable("ticket_counters", {
  projectID: uuid("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  lastNumber: integer("last_number").notNull().default(0),
});

export const ticketLabels = pgTable(
  "ticket_labels",
  {
    ticketID: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    labelID: uuid("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.ticketID, table.labelID] })]
);

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  project: one(projects, { fields: [tickets.projectID], references: [projects.id] }),
  status: one(statuses, { fields: [tickets.statusID], references: [statuses.id] }),
  reporter: one(users, { fields: [tickets.reporterID], references: [users.id], relationName: "ticket_reporter" }),
  assignee: one(users, { fields: [tickets.assigneeID], references: [users.id], relationName: "ticket_assignee" }),
  parent: one(tickets, { fields: [tickets.parentTicketID], references: [tickets.id], relationName: "ticket_parent" }),
  children: many(tickets, { relationName: "ticket_parent" }),
  labels: many(ticketLabels),
  comments: many(comments),
  outgoingLinks: many(ticketLinks, { relationName: "link_source" }),
  incomingLinks: many(ticketLinks, { relationName: "link_target" }),
  attachments: many(attachments),
}));

export const ticketLabelsRelations = relations(ticketLabels, ({ one }) => ({
  ticket: one(tickets, { fields: [ticketLabels.ticketID], references: [tickets.id] }),
  label: one(labels, { fields: [ticketLabels.labelID], references: [labels.id] }),
}));

export const ticketActivity = pgTable(
  "ticket_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketID: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    userID: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
    action: activityActionEnum("activity_action").notNull(),
    fieldName: text("field_name"),
    oldValue: jsonb("old_value").$type<ActivityValue | null>(),
    newValue: jsonb("new_value").$type<ActivityValue | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_activity_ticket_time").on(table.ticketID, table.createdAt), index("idx_activity_project_time").on(table.createdAt)]
);

export const ticketActivityRelations = relations(ticketActivity, ({ one }) => ({
  ticket: one(tickets, { fields: [ticketActivity.ticketID], references: [tickets.id] }),
  user: one(users, { fields: [ticketActivity.userID], references: [users.id] }),
}));

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketID: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    authorID: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_comments_ticket")
      .on(table.ticketID)
      .where(sql`${table.deletedAt} IS NULL`),
    index("idx_comments_ticket_time").on(table.ticketID, table.createdAt),
    check("ck_comments_body_nonempty", sql`length(trim(${table.body})) > 0`),
  ]
);

export const commentsRelations = relations(comments, ({ one }) => ({
  ticket: one(tickets, { fields: [comments.ticketID], references: [tickets.id] }),
  author: one(users, { fields: [comments.authorID], references: [users.id] }),
}));

export const ticketLinks = pgTable(
  "ticket_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceTicketID: uuid("source_ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    targetTicketID: uuid("target_ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    linkType: linkTypeEnum("link_type").notNull(),
    createdByID: uuid("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("uq_ticket_links").on(table.sourceTicketID, table.targetTicketID, table.linkType),
    index("idx_ticket_links_source").on(table.sourceTicketID),
    index("idx_ticket_links_target").on(table.targetTicketID),
    check("ck_ticket_links_no_self", sql`${table.sourceTicketID} <> ${table.targetTicketID}`),
  ]
);

export const ticketLinksRelations = relations(ticketLinks, ({ one }) => ({
  source: one(tickets, { fields: [ticketLinks.sourceTicketID], references: [tickets.id], relationName: "link_source" }),
  target: one(tickets, { fields: [ticketLinks.targetTicketID], references: [tickets.id], relationName: "link_target" }),
  createdBy: one(users, { fields: [ticketLinks.createdByID], references: [users.id] }),
}));

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketID: uuid("ticket_id").references(() => tickets.id, { onDelete: "cascade" }),
    commentID: uuid("comment_id").references(() => comments.id, { onDelete: "cascade" }),
    uploaderID: uuid("uploader_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    filename: text("filename").notNull(),
    storageKey: text("storage_key").notNull(),
    contentHash: text("content_hash").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    mimeType: text("mime_type").notNull(),
    isImage: boolean("is_image").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_attachments_ticket").on(table.ticketID),
    index("idx_attachments_comment").on(table.commentID),
    index("idx_attachments_hash").on(table.contentHash),
    check("ck_attachments_owner", sql`(${table.ticketID} IS NOT NULL) OR (${table.commentID} IS NOT NULL)`),
  ]
);

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  ticket: one(tickets, { fields: [attachments.ticketID], references: [tickets.id] }),
  comment: one(comments, { fields: [attachments.commentID], references: [comments.id] }),
  uploader: one(users, { fields: [attachments.uploaderID], references: [users.id] }),
}));
