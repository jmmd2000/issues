import { sql } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { AuthService } from "../services/authService";
import { ProjectService } from "../services/projectService";

const DEV_USER = { name: "James", email: "james@test.com", password: "test123" };

const DEV_PROJECTS = [
  { key: "WEB", name: "Website", description: "Personal website", visibility: "public" as const, repo: "github.com/acme/web", stack: ["SvelteKit", "TypeScript"] },
  { key: "API", name: "API", description: "Core backend API.", visibility: "public" as const, repo: "github.com/acme/api", stack: ["Hono", "Postgres"] },
  { key: "BLOG", name: "Blog", description: "Music blog.", visibility: "private" as const, repo: null, stack: ["React, Express.js"] },
  { key: "OPS", name: "Infrastructure", description: "Deployment and tooling.", visibility: "private" as const, repo: "github.com/acme/ops", stack: ["Jenkins", "Docker"] },
];

async function seed() {
  await db.execute(sql`TRUNCATE TABLE labels, statuses, project_members, projects, sessions, users CASCADE`);

  await AuthService.createUser(DEV_USER.name, DEV_USER.email, DEV_USER.password);
  const [{ id: ownerID }] = await db.select({ id: users.id }).from(users).limit(1);

  for (const project of DEV_PROJECTS) {
    await ProjectService.createProject({ ...project, ownerID });
  }

  console.log(`Seeded ${DEV_PROJECTS.length} projects owned by ${DEV_USER.email}.`);
  console.log(`Login: ${DEV_USER.email} / ${DEV_USER.password}`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
