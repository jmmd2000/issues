import { db } from "../db";
import { eq } from "drizzle-orm";
import { projects } from "../db/schema";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { canView, type Role } from "../lib/access";

type ProjectContext = {
  id: string;
  visibility: "public" | "private";
};

type Env = { Variables: { userID: string; role: Role; project: ProjectContext } };
type ReadEnv = { Variables: { userID?: string; role?: Role; project: ProjectContext } };

/**
 * Resolves a project by its `:key` param and allows the request when the
 * project is public _or_ the caller is a member _or_ the caller is a service
 * user. Must run after `optionalAuth` so anonymous callers can be identified.
 * On success, sets `project` on the context.
 *
 * Downstream handlers should consult `canView(c.get("role"), project, ticket)`
 * for per-ticket visibility decisions rather than re-deriving the rule.
 * @throws 404 if the project does not exist, or if the project is private and
 * the caller cannot see it
 */
export const requireProjectRead = createMiddleware<ReadEnv>(async (c, next) => {
  const key = c.req.param("key")!.toUpperCase();

  const project = await db.query.projects.findFirst({
    where: eq(projects.key, key),
    columns: { id: true, visibility: true },
  });

  const notFound = new HTTPException(404, { message: `Project with key ${key} not found.` });
  if (!project) throw notFound;
  if (!canView(c.get("role"), project)) throw notFound;

  c.set("project", project);
  await next();
});

/**
 * Resolves a project by its `:key` param and gates access based on the
 * caller's membership. Must run _after_ `requireAuth`. On success, sets
 * `project` on the context.
 * @param level The required access level: `"member"` allows any project
 * member (or any service user), `"owner"` restricts to the project owner
 * @throws 404 if the project does not exist or the caller is not a member
 * @throws 403 if the caller is a member but not the owner (when `level === "owner"`)
 */
export const requireProjectAccess = (level: "member" | "owner") =>
  createMiddleware<Env>(async (c, next) => {
    const key = c.req.param("key")!.toUpperCase();
    const role = c.get("role");

    const project = await db.query.projects.findFirst({
      where: eq(projects.key, key),
      columns: { id: true, visibility: true },
    });

    const notFound = new HTTPException(404, { message: `Project with key ${key} not found.` });
    if (!project) throw notFound;

    const membership = role.memberships.get(project.id);
    if (!membership) {
      if (level === "owner" || !role.isService) throw notFound;
    } else if (level === "owner" && membership !== "owner") {
      throw new HTTPException(403, { message: "Only the project owner can perform this action." });
    }

    c.set("project", project);
    await next();
  });
