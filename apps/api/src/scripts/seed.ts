import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "../db";
import { labels, statuses, users } from "../db/schema";
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
  statusSlug: string;
  priority?: Priority;
  labelSlugs?: string[];
  assignSelf?: boolean;
};

const LOREM_TICKET_TITLES = [
  "Lorem ipsum dolor sit amet",
  "Consectetur adipiscing elit",
  "Sed do eiusmod tempor",
  "Incididunt ut labore",
  "Dolore magna aliqua",
  "Ut enim ad minim veniam",
  "Quis nostrud exercitation",
  "Ullamco laboris nisi",
  "Aliquip ex ea commodo",
  "Duis aute irure dolor",
] as const;

const LOREM_TICKET_DESCRIPTIONS = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer posuere erat a ante venenatis dapibus posuere velit aliquet.",
  "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
  "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
] as const;

function getLoremTicketCopy(index: number) {
  return {
    title: LOREM_TICKET_TITLES[index % LOREM_TICKET_TITLES.length],
    description: LOREM_TICKET_DESCRIPTIONS[index % LOREM_TICKET_DESCRIPTIONS.length],
  };
}

const TICKET_SEEDS: Record<string, TicketSeed[]> = {
  DASH: [
    {
      statusSlug: "in-progress",
      priority: "critical",
      labelSlugs: ["task", "improvement"],
      assignSelf: true,
    },
    {
      statusSlug: "in-review",
      priority: "high",
      labelSlugs: ["feature"],
      assignSelf: true,
    },
    {
      statusSlug: "todo",
      priority: "high",
      labelSlugs: ["feature"],
    },
    {
      statusSlug: "backlog",
      priority: "critical",
      labelSlugs: ["bug"],
    },
    {
      statusSlug: "backlog",
      priority: "medium",
      labelSlugs: ["task"],
    },
    {
      statusSlug: "done",
      priority: "medium",
      labelSlugs: ["improvement"],
    },
    {
      statusSlug: "todo",
      priority: "low",
      labelSlugs: ["chore"],
    },
  ],
  ISSUE: [
    {
      statusSlug: "in-progress",
      priority: "high",
      labelSlugs: ["feature", "improvement"],
      assignSelf: true,
    },
    {
      statusSlug: "todo",
      priority: "high",
      labelSlugs: ["feature"],
    },
    {
      statusSlug: "done",
      priority: "critical",
      labelSlugs: ["chore"],
    },
    {
      statusSlug: "in-review",
      priority: "critical",
      labelSlugs: ["bug"],
      assignSelf: true,
    },
    {
      statusSlug: "backlog",
      priority: "medium",
      labelSlugs: ["improvement"],
    },
    {
      statusSlug: "todo",
      priority: "medium",
      labelSlugs: ["feature"],
    },
  ],
  ALBUM: [
    {
      statusSlug: "in-progress",
      priority: "critical",
      labelSlugs: ["bug", "task"],
      assignSelf: true,
    },
    {
      statusSlug: "todo",
      priority: "high",
      labelSlugs: ["feature"],
    },
    {
      statusSlug: "backlog",
      priority: "medium",
      labelSlugs: ["chore"],
    },
    {
      statusSlug: "in-review",
      priority: "high",
      labelSlugs: ["bug"],
    },
    {
      statusSlug: "done",
      priority: "medium",
      labelSlugs: ["feature"],
    },
  ],
  OPS: [
    {
      statusSlug: "todo",
      priority: "critical",
      labelSlugs: ["task", "chore"],
      assignSelf: true,
    },
    {
      statusSlug: "in-progress",
      priority: "none",
      labelSlugs: ["improvement"],
    },
    {
      statusSlug: "backlog",
      priority: "medium",
      labelSlugs: ["chore"],
    },
    {
      statusSlug: "in-review",
      priority: "high",
      labelSlugs: ["improvement"],
      assignSelf: true,
    },
    {
      statusSlug: "done",
      priority: "medium",
      labelSlugs: ["chore"],
    },
  ],
  DOCS: [
    {
      statusSlug: "done",
      priority: "high",
      labelSlugs: ["chore"],
    },
    {
      statusSlug: "in-progress",
      priority: "medium",
      labelSlugs: ["task"],
      assignSelf: true,
    },
    {
      statusSlug: "todo",
      priority: "medium",
      labelSlugs: ["task"],
    },
    {
      statusSlug: "backlog",
      priority: "low",
      labelSlugs: ["chore"],
    },
    {
      statusSlug: "todo",
      priority: "low",
      labelSlugs: ["improvement"],
    },
  ],
};

async function seedTicketsForProject(projectID: string, ownerID: string, seeds: TicketSeed[]) {
  const projectStatuses = await db.select({ id: statuses.id, slug: statuses.slug }).from(statuses).where(eq(statuses.projectID, projectID));
  const projectLabels = await db.select({ id: labels.id, name: labels.name }).from(labels).where(eq(labels.projectID, projectID));
  const statusBySlug = new Map(projectStatuses.map((s) => [s.slug, s.id]));
  const labelBySlug = new Map(projectLabels.map((l) => [l.name.toLowerCase(), l.id]));

  for (const [index, seed] of seeds.entries()) {
    const copy = getLoremTicketCopy(index);
    const statusID = statusBySlug.get(seed.statusSlug);
    if (!statusID) throw new Error(`Missing status '${seed.statusSlug}' for project ${projectID}`);
    const labelIDs = seed.labelSlugs?.map((slug) => {
      const labelID = labelBySlug.get(slug);
      if (!labelID) throw new Error(`Missing label '${slug}' for project ${projectID}`);
      return labelID;
    });

    await TicketService.createTicket({
      projectID,
      reporterID: ownerID,
      title: copy.title,
      description: copy.description,
      statusID,
      priority: seed.priority,
      assigneeID: seed.assignSelf ? ownerID : undefined,
      labelIDs: labelIDs?.length ? labelIDs : undefined,
    });
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

    const seeds = TICKET_SEEDS[project.key] ?? [];
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
