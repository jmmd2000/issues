import { eq, sql } from "drizzle-orm";
import { statuses, tickets } from "../../db/schema";
import type { StatusCategory, Transaction } from "../../lib/types";

export const CLOSED_CATEGORIES: readonly StatusCategory[] = ["done", "cancelled"];

export class TicketLifecycle {
  /**
   * Resolves how `completedAt` should change when a ticket moves to a new
   * status. Closed-category targets stamp `now()` on first entry and preserve
   * existing timestamps; open-category targets clear the field.
   * @param tx The active transaction
   * @param newStatusID The destination status ID
   */
  static async completedAtUpdate(tx: Transaction, newStatusID: string) {
    const [next] = await tx.select({ category: statuses.category }).from(statuses).where(eq(statuses.id, newStatusID)).limit(1);
    if (!next) return {};
    if (CLOSED_CATEGORIES.includes(next.category)) {
      return { completedAt: sql`coalesce(${tickets.completedAt}, now())` };
    }
    return { completedAt: null };
  }
}
