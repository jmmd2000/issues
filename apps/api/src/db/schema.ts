import { relations } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, jsonb, integer, primaryKey, unique, index } from "drizzle-orm/pg-core";

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
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
  category: text("category", { enum: ["backlog", "active", "done"] }).notNull().default("active"),
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
