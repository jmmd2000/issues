import { db } from "../db";
import { eq } from "drizzle-orm";
import { projects } from "../db/schema";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

type ProjectContext = {
  id: string;
  visibility: "public" | "private";
  members: { userID: string; role: "owner" | "member" }[];
};

type Env = { Variables: { userID: string; project: ProjectContext } };

/**
 * Middleware that resolves a project by its `:key` param and gates access based on the user's membership.
 * Must run _after_ `requireAuth`. On success, sets the resolved project on the context as `project`.
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
    if (!membership) throw notFound;
    if (level === "owner" && membership.role !== "owner") {
      throw new HTTPException(403, { message: "Only the project owner can perform this action." });
    }

    c.set("project", project);
    await next();
  });
