import { eq, inArray, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "../db";
import { labels, statuses, tickets, users } from "../db/schema";
import type { Priority } from "../lib/types";
import { AuthService } from "../services/authService";
import { ProjectService } from "../services/projectService";
import { TicketService } from "../services/ticketService";

const DEV_USER = { name: "James", email: "james@test.com", password: "password123" };

type ProjectSeed = {
  key: string;
  name: string;
  description: string;
  visibility: "public" | "private";
  repo: string | null;
  stack: string[];
};

const DEV_PROJECTS = [
  {
    key: "DASH",
    name: "Dashboard Rewrite",
    description: "A full rewrite of the dashboard using modern tooling. Focuses on performance, accessibility, and developer experience across all screen sizes.",
    visibility: "public",
    repo: "https://github.com/jamesmddoyle/issues-dashboard",
    stack: ["React", "TypeScript", "Tailwind", "PostgreSQL", "Hono"],
  },
  {
    key: "ISSUE",
    name: "Issue Tracker Core",
    description: "The main product surface for projects, tickets, workflow statuses, labels, membership, and activity history. Prioritises fast triage and clear ownership.",
    visibility: "public",
    repo: "https://github.com/jamesmddoyle/issues",
    stack: ["SvelteKit", "TypeScript", "Hono", "Drizzle", "PostgreSQL", "Zod"],
  },
  {
    key: "ALBUM",
    name: "Album Review Library",
    description: "A private music review workspace for importing Spotify albums, writing long-form reviews, and tracking catalogue clean-up work across artists and releases.",
    visibility: "private",
    repo: "https://github.com/jamesmddoyle/album-reviews",
    stack: ["SvelteKit", "Node.js", "Spotify API", "PostgreSQL", "Docker"],
  },
  {
    key: "OPS",
    name: "Release Infrastructure",
    description: "Deployment, observability, backups, and local development tooling for the issue tracker. Covers the path from commit to running production service.",
    visibility: "private",
    repo: "https://github.com/jamesmddoyle/issues-infra",
    stack: ["Docker", "GitHub Actions", "PostgreSQL", "Grafana", "Terraform"],
  },
  {
    key: "DOCS",
    name: "Contributor Docs",
    description: "A documentation refresh covering architecture notes, API conventions, database migrations, testing workflows, and onboarding for new contributors.",
    visibility: "public",
    repo: "https://github.com/jamesmddoyle/issues-docs",
    stack: ["Markdown", "SvelteKit", "TypeScript", "Playwright", "Mermaid"],
  },
] satisfies ProjectSeed[];

type TicketSeed = {
  title: string;
  description: string;
  statusSlug: string;
  priority: Priority;
  labelSlugs: string[];
  assignSelf: boolean;
  completedDaysAgo?: number;
};

const TICKETS_PER_PROJECT = 120;
const STATUS_SEQUENCE = ["backlog", "todo", "todo", "in-progress", "in-progress", "in-review", "done", "done", "cancelled"] as const;
const PRIORITY_SEQUENCE: Priority[] = ["critical", "high", "medium", "low", "none", "medium", "high", "low"];
const LABEL_SEQUENCES = [["bug"], ["feature"], ["improvement"], ["task"], ["chore"], ["feature", "improvement"], ["bug", "task"], ["task", "chore"]];
const TICKET_ACTIONS = ["Add", "Audit", "Fix", "Refine", "Document", "Wire", "Review", "Harden", "Measure", "Clean up", "Split", "Validate"] as const;
const TICKET_AREAS = [
  "ticket filtering",
  "keyboard navigation",
  "empty states",
  "pagination controls",
  "activity history",
  "project settings",
  "kanban movement",
  "label editing",
  "auth session handling",
  "markdown rendering",
] as const;
const TICKET_OUTCOMES = [
  "for first-time users",
  "before release",
  "after API changes",
  "for mobile layouts",
  "when data is missing",
  "under heavy test data",
  "with slower network responses",
  "for owner-only workflows",
] as const;

function buildTicketTitle(project: ProjectSeed, index: number) {
  const action = TICKET_ACTIONS[(index + project.key.length) % TICKET_ACTIONS.length];
  const area = TICKET_AREAS[(index * 3 + project.name.length) % TICKET_AREAS.length];
  const outcome = TICKET_OUTCOMES[(index * 5 + project.stack.length) % TICKET_OUTCOMES.length];
  return `${action} ${area} ${outcome}`;
}

function buildTicketDescription(project: ProjectSeed, index: number, statusSlug: string, priority: Priority) {
  return [
    `Seed ticket for ${project.name}.`,
    `Use this item to exercise pagination, sorting, column visibility, kanban drag-and-drop, and dense list/table rendering.`,
    `Generated index: ${index + 1}. Status: ${statusSlug}. Priority: ${priority}.`,
  ].join("\n\n");
}

function buildTicketSeeds(project: ProjectSeed) {
  return Array.from({ length: TICKETS_PER_PROJECT }, (_, index): TicketSeed => {
    const statusSlug = STATUS_SEQUENCE[(index + project.key.length) % STATUS_SEQUENCE.length];
    const priority = PRIORITY_SEQUENCE[(index * 2 + project.key.length) % PRIORITY_SEQUENCE.length];

    return {
      title: buildTicketTitle(project, index),
      description: buildTicketDescription(project, index, statusSlug, priority),
      statusSlug,
      priority,
      labelSlugs: LABEL_SEQUENCES[(index + project.stack.length) % LABEL_SEQUENCES.length],
      assignSelf: index % 3 !== 0,
    };
  });
}

const VOLUME_DISTRIBUTION = {
  backlog: 250,
  todoActive: 12,
  inProgressActive: 10,
  inReviewActive: 8,
  doneRecent: 20,
  doneOld: 50,
} as const;

function buildVolumeSeeds(project: ProjectSeed): TicketSeed[] {
  const seeds: TicketSeed[] = [];
  let counter = 0;

  function push(statusSlug: string, count: number, builder: (index: number) => Partial<TicketSeed> = () => ({})) {
    for (let i = 0; i < count; i++) {
      const priority = PRIORITY_SEQUENCE[(counter * 3) % PRIORITY_SEQUENCE.length];
      seeds.push({
        title: buildTicketTitle(project, counter),
        description: buildTicketDescription(project, counter, statusSlug, priority),
        statusSlug,
        priority,
        labelSlugs: LABEL_SEQUENCES[counter % LABEL_SEQUENCES.length],
        assignSelf: counter % 4 !== 0,
        ...builder(i),
      });
      counter++;
    }
  }

  push("backlog", VOLUME_DISTRIBUTION.backlog);
  push("todo", VOLUME_DISTRIBUTION.todoActive);
  push("in-progress", VOLUME_DISTRIBUTION.inProgressActive);
  push("in-review", VOLUME_DISTRIBUTION.inReviewActive);
  push("done", VOLUME_DISTRIBUTION.doneRecent, (i) => ({ completedDaysAgo: (i % 13) + 1 }));
  push("done", VOLUME_DISTRIBUTION.doneOld, (i) => ({ completedDaysAgo: 18 + (i % 90) }));

  return seeds;
}

async function seedTicketsForProject(projectID: string, ownerID: string, seeds: TicketSeed[]) {
  const projectStatuses = await db.select({ id: statuses.id, slug: statuses.slug }).from(statuses).where(eq(statuses.projectID, projectID));
  const projectLabels = await db.select({ id: labels.id, name: labels.name }).from(labels).where(eq(labels.projectID, projectID));
  const statusBySlug = new Map(projectStatuses.map((s) => [s.slug, s.id]));
  const labelBySlug = new Map(projectLabels.map((l) => [l.name.toLowerCase(), l.id]));

  const backdates = new Map<number, string[]>();

  for (const seed of seeds) {
    const statusID = statusBySlug.get(seed.statusSlug);
    if (!statusID) throw new Error(`Missing status '${seed.statusSlug}' for project ${projectID}`);
    const labelIDs = seed.labelSlugs.map((slug) => {
      const labelID = labelBySlug.get(slug);
      if (!labelID) throw new Error(`Missing label '${slug}' for project ${projectID}`);
      return labelID;
    });

    const ticket = await TicketService.createTicket({
      projectID,
      reporterID: ownerID,
      title: seed.title,
      description: seed.description,
      statusID,
      priority: seed.priority,
      assigneeID: seed.assignSelf ? ownerID : undefined,
      labelIDs: labelIDs.length ? labelIDs : undefined,
    });

    if (seed.completedDaysAgo !== undefined) {
      const bucket = backdates.get(seed.completedDaysAgo) ?? [];
      bucket.push(ticket.id);
      backdates.set(seed.completedDaysAgo, bucket);
    }
  }

  for (const [days, ids] of backdates) {
    await db
      .update(tickets)
      .set({ completedAt: sql`now() - make_interval(days => ${days})` })
      .where(inArray(tickets.id, ids));
  }
}

async function seed() {
  await migrate(db, { migrationsFolder: "./drizzle" });
  await db.execute(sql`TRUNCATE TABLE ticket_activity, ticket_labels, ticket_counters, tickets, labels, statuses, project_members, projects, sessions, users CASCADE`);

  await AuthService.createUser(DEV_USER.name, DEV_USER.email, DEV_USER.password);
  const [{ id: ownerID }] = await db.select({ id: users.id }).from(users).limit(1);

  let ticketCount = 0;
  for (const project of DEV_PROJECTS) {
    const created = await ProjectService.createProject({ ...project, ownerID });

    const seeds = project.key === "VOLUME" ? buildVolumeSeeds(project) : buildTicketSeeds(project);
    await seedTicketsForProject(created.id, ownerID, seeds);
    ticketCount += seeds.length;
  }

  console.log(`Seeded ${DEV_PROJECTS.length} projects and ${ticketCount} tickets owned by ${DEV_USER.email}.`);
  console.log(`Login: ${DEV_USER.email} / ${DEV_USER.password}`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
