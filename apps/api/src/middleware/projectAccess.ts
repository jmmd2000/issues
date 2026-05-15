import { db } from "../db";
import { eq } from "drizzle-orm";
import { projects, users } from "../db/schema";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

async function isServiceUser(userID: string): Promise<boolean> {
  const [row] = await db.select({ isService: users.isService }).from(users).where(eq(users.id, userID)).limit(1);
  return !!row?.isService;
}

type ProjectContext = {
  id: string;
  visibility: "public" | "private";
  members: { userID: string; role: "owner" | "member" }[];
};

type Env = { Variables: { userID: string; project: ProjectContext; viewerCanSeePrivate: boolean } };
type ReadEnv = { Variables: { userID?: string; project: ProjectContext; viewerCanSeePrivate: boolean } };

/**
 * Middleware that resolves a project by its `:key` param and allows the
 * request when the project is public _or_ the caller is a member. Must run
 * after `optionalAuth` so anonymous callers can be identified. On success,
 * sets `project` and `viewerCanSeePrivate` on the context. `viewerCanSeePrivate`
 * is true when the caller is a member of the project or a service user.
 * @throws 404 if the project does not exist, or if the project is private and the caller is not a member
 */
export const requireProjectRead = createMiddleware<ReadEnv>(async (c, next) => {
  const key = c.req.param("key")!.toUpperCase();
  const userID = c.get("userID");

  const project = await db.query.projects.findFirst({
    where: eq(projects.key, key),
    columns: { id: true, visibility: true },
    with: { members: { columns: { userID: true, role: true } } },
  });

  const notFound = new HTTPException(404, { message: `Project with key ${key} not found.` });
  if (!project) throw notFound;

  const isMember = !!userID && project.members.some((m) => m.userID === userID);
  const isService = !isMember && !!userID && (await isServiceUser(userID));
  const viewerCanSeePrivate = isMember || isService;

  if (project.visibility !== "public" && !viewerCanSeePrivate) throw notFound;

  c.set("project", project);
  c.set("viewerCanSeePrivate", viewerCanSeePrivate);
  await next();
});

/**
 * Middleware that resolves a project by its `:key` param and gates access based on the user's membership.
 * Must run _after_ `requireAuth`. On success, sets `project` and `viewerCanSeePrivate` on the context.
 * Anyone who passes this middleware can see private tickets, so `viewerCanSeePrivate` is always true.
 * @param level The required access level: `"member"` allows any project member, `"owner"` restricts to the project owner
 * @throws 404 if the project does not exist, or if the caller is not a member
 * @throws 403 if the caller is a member but not the owner
 */
export const requireProjectAccess = (level: "member" | "owner") =>
  createMiddleware<Env>(async (c, next) => {
    const key = c.req.param("key")!.toUpperCase();
    const userID = c.get("userID");

    const project = await db.query.projects.findFirst({
      where: eq(projects.key, key),
      columns: { id: true, visibility: true },
      with: { members: { columns: { userID: true, role: true } } },
    });

    const notFound = new HTTPException(404, { message: `Project with key ${key} not found.` });
    if (!project) throw notFound;

    const membership = project.members.find((m) => m.userID === userID);
    if (!membership) {
      if (level === "owner" || !(await isServiceUser(userID))) throw notFound;
    } else if (level === "owner" && membership.role !== "owner") {
      throw new HTTPException(403, { message: "Only the project owner can perform this action." });
    }

    c.set("project", project);
    c.set("viewerCanSeePrivate", true);
    await next();
  });
