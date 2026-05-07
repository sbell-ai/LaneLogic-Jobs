import { db } from "../db";
import {
  adminProductEntitlements,
  type AdminProductEntitlement,
} from "@shared/schema";
import { eq } from "drizzle-orm";

export const adminProductEntitlementStorage = {
  async getAdminProductEntitlements(productId: number): Promise<AdminProductEntitlement[]> {
    return await db.select().from(adminProductEntitlements).where(eq(adminProductEntitlements.productId, productId));
  },
  async setAdminProductEntitlements(productId: number, entitlementIds: number[]): Promise<void> {
    await db.delete(adminProductEntitlements).where(eq(adminProductEntitlements.productId, productId));
    if (entitlementIds.length > 0) {
      await db.insert(adminProductEntitlements).values(
        entitlementIds.map(eid => ({ productId, entitlementId: eid }))
      );
    }
  },
};
