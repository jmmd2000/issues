import { and, asc, eq, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../db";
import { comments } from "../db/schema";
import { ActivityService } from "./activityService";
import type { Comment } from "../lib/types";

type CommentRow = typeof comments.$inferSelect;
type AuthorRow = { id: string; name: string; avatarURL: string | null };

function shape(row: CommentRow & { author: AuthorRow }): Comment {
  const isDeleted = row.deletedAt !== null;
  return {
    id: row.id,
    ticketID: row.ticketID,
    authorID: row.authorID,
    body: isDeleted ? null : row.body,
    isDeleted,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt ? row.editedAt.toISOString() : null,
    author: row.author,
  };
}

export class CommentService {
  /**
   * Lists every comment for a ticket in chronological order. Soft-deleted
   * comments are returned as tombstones (`body` nulled, `isDeleted` true) so
   * the thread keeps its shape and any "edited" / "deleted" activity rows
   * remain interpretable.
   * @param ticketID The ID of the parent ticket.
   * @returns The list of comments with author info.
   */
  static async listForTicket(ticketID: string): Promise<Comment[]> {
    const rows = await db.query.comments.findMany({
      where: eq(comments.ticketID, ticketID),
      orderBy: [asc(comments.createdAt)],
      with: {
        author: { columns: { id: true, name: true, avatarURL: true } },
      },
    });
    return rows.map(shape);
  }

  /**
   * Inserts a comment and writes a `comment_added` activity row in the same
   * transaction. Caller must have verified ticket access.
   * @param ticketID The ID of the parent ticket.
   * @param authorID The ID of the user adding the comment.
   * @param body The markdown body.
   * @returns The newly created comment.
   */
  static async createComment(ticketID: string, authorID: string, body: string): Promise<Comment> {
    return await db.transaction(async (tx) => {
      const [row] = await tx.insert(comments).values({ ticketID, authorID, body }).returning();
      await ActivityService.logComment(tx, { userID: authorID, ticketID, kind: "added", comment: { id: row.id, body: row.body } });

      const author = await tx.query.users.findFirst({
        where: (user, { eq }) => eq(user.id, authorID),
        columns: { id: true, name: true, avatarURL: true },
      });
      // FK on comments.author_id guarantees the user exists at this point.
      return shape({ ...row, author: author! });
    });
  }

  /**
   * Edits a comment's body. Only the original author may edit. Stamps
   * `editedAt = now()` and writes a `comment_edited` activity row carrying the
   * full old/new bodies for diff rendering.
   * @param commentID The ID of the comment to edit.
   * @param ticketID The ID of the parent ticket (scope check).
   * @param authorID The ID of the requesting user; must match the comment author.
   * @param body The new markdown body.
   * @throws HTTPException 404 when missing/wrong ticket/soft-deleted, 403 when caller is not the author.
   * @returns The updated comment.
   */
  static async updateComment(commentID: string, ticketID: string, authorID: string, body: string): Promise<Comment> {
    return await db.transaction(async (tx) => {
      const existing = await tx.query.comments.findFirst({
        where: and(eq(comments.id, commentID), eq(comments.ticketID, ticketID), isNull(comments.deletedAt)),
        with: { author: { columns: { id: true, name: true, avatarURL: true } } },
      });
      if (!existing) throw new HTTPException(404, { message: `Comment with id ${commentID} not found.` });
      if (existing.authorID !== authorID) throw new HTTPException(403, { message: "Only the author can edit this comment." });

      const [row] = await tx.update(comments).set({ body, editedAt: new Date() }).where(eq(comments.id, commentID)).returning();

      await ActivityService.logComment(tx, { userID: authorID, ticketID, kind: "edited", comment: { id: row.id, body: row.body }, prevBody: existing.body });

      return shape({ ...row, author: existing.author });
    });
  }

  /**
   * Soft-deletes a comment by setting `deletedAt`. Only the author may delete.
   * Writes a `comment_deleted` activity row carrying the pre-delete excerpt.
   * The row is preserved so the thread keeps its shape.
   * @param commentID The ID of the comment to delete.
   * @param ticketID The ID of the parent ticket (scope check).
   * @param authorID The ID of the requesting user; must match the comment author.
   * @throws HTTPException 404 when missing/wrong ticket/already deleted, 403 when caller is not the author.
   */
  static async softDeleteComment(commentID: string, ticketID: string, authorID: string): Promise<void> {
    await db.transaction(async (tx) => {
      const existing = await tx.query.comments.findFirst({
        where: and(eq(comments.id, commentID), eq(comments.ticketID, ticketID), isNull(comments.deletedAt)),
      });
      if (!existing) throw new HTTPException(404, { message: `Comment with id ${commentID} not found.` });
      if (existing.authorID !== authorID) throw new HTTPException(403, { message: "Only the author can delete this comment." });

      await tx.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, commentID));
      await ActivityService.logComment(tx, { userID: authorID, ticketID, kind: "deleted", comment: { id: existing.id, body: existing.body } });
    });
  }
}
