import { db } from "../db";
import {
  entitlementUsageWindows,
  type EntitlementUsageWindow,
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

export const entitlementUsageStorage = {
  async getOrCreateUsageWindow(userId: number, entitlementKey: string, windowStart: Date, windowEnd: Date, txDb: any = db): Promise<EntitlementUsageWindow> {
    const [w] = await txDb.insert(entitlementUsageWindows).values({
      userId, entitlementKey, windowStart, windowEnd, usedCount: 0
    }).onConflictDoNothing().returning();
    if (w) return w;
    const [existing] = await txDb.select().from(entitlementUsageWindows).where(
      and(
        eq(entitlementUsageWindows.userId, userId),
        eq(entitlementUsageWindows.entitlementKey, entitlementKey),
        eq(entitlementUsageWindows.windowStart, windowStart)
      )
    );
    return existing;
  },

  async incrementUsageWindow(windowId: number, txDb: any = db): Promise<EntitlementUsageWindow> {
    const [w] = await txDb.update(entitlementUsageWindows)
      .set({ usedCount: sql`${entitlementUsageWindows.usedCount} + 1` })
      .where(eq(entitlementUsageWindows.id, windowId))
      .returning();
    return w;
  },

  async incrementUsageWindowAtomic(windowId: number, maxCount: number, txDb: any = db): Promise<EntitlementUsageWindow | null> {
    const rows = await txDb.update(entitlementUsageWindows)
      .set({ usedCount: sql`${entitlementUsageWindows.usedCount} + 1` })
      .where(and(
        eq(entitlementUsageWindows.id, windowId),
        sql`${entitlementUsageWindows.usedCount} < ${maxCount}`
      ))
      .returning();
    return rows.length > 0 ? rows[0] : null;
  },
};
