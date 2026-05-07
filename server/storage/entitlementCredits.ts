import { db } from "../db";
import {
  entitlementCreditGrants, entitlementCreditConsumptions,
  type EntitlementCreditGrant, type InsertEntitlementCreditGrant,
  type EntitlementCreditConsumption, type InsertEntitlementCreditConsumption,
} from "@shared/schema";
import { eq, and, sql, asc, gt, gte } from "drizzle-orm";

export const entitlementCreditStorage = {
  async createCreditGrant(grant: InsertEntitlementCreditGrant, txDb: any = db): Promise<EntitlementCreditGrant> {
    const [g] = await txDb.insert(entitlementCreditGrants).values(grant).returning();
    return g;
  },

  async getActiveCreditGrants(userId: number, entitlementKey: string, txDb: any = db): Promise<EntitlementCreditGrant[]> {
    const now = new Date();
    return await txDb.select().from(entitlementCreditGrants).where(
      and(
        eq(entitlementCreditGrants.userId, userId),
        eq(entitlementCreditGrants.entitlementKey, entitlementKey),
        eq(entitlementCreditGrants.status, "Active"),
        gt(entitlementCreditGrants.amountRemaining, 0),
        gt(entitlementCreditGrants.expiresAt, now)
      )
    ).orderBy(asc(entitlementCreditGrants.expiresAt), asc(entitlementCreditGrants.grantedAt));
  },

  async consumeCreditFromGrant(grantId: number, amount: number, txDb: any = db): Promise<EntitlementCreditGrant> {
    const [g] = await txDb.update(entitlementCreditGrants)
      .set({ amountRemaining: sql`${entitlementCreditGrants.amountRemaining} - ${amount}` })
      .where(and(
        eq(entitlementCreditGrants.id, grantId),
        gte(entitlementCreditGrants.amountRemaining, amount)
      ))
      .returning();
    return g;
  },

  async createCreditConsumption(consumption: InsertEntitlementCreditConsumption, txDb: any = db): Promise<EntitlementCreditConsumption> {
    const [c] = await txDb.insert(entitlementCreditConsumptions).values(consumption).returning();
    return c;
  },

  async getUserCreditSummary(userId: number, entitlementKey: string, txDb: any = db): Promise<{ totalRemaining: number; grants: EntitlementCreditGrant[] }> {
    const grants = await entitlementCreditStorage.getActiveCreditGrants(userId, entitlementKey, txDb);
    const totalRemaining = grants.reduce((sum, g) => sum + g.amountRemaining, 0);
    return { totalRemaining, grants };
  },

  async getCreditGrantByPaymentIntent(paymentIntentId: string, txDb: any = db): Promise<EntitlementCreditGrant | undefined> {
    const [g] = await txDb.select().from(entitlementCreditGrants).where(
      eq(entitlementCreditGrants.stripePaymentIntentId, paymentIntentId)
    );
    return g;
  },
};
