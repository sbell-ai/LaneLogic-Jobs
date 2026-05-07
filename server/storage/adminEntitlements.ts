import { db } from "../db";
import {
  adminEntitlements, adminProductOverrides, adminProductEntitlements,
  type AdminEntitlement, type InsertAdminEntitlement,
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export const adminEntitlementStorage = {
  async getAdminEntitlements(): Promise<AdminEntitlement[]> {
    return await db.select().from(adminEntitlements).orderBy(desc(adminEntitlements.createdAt));
  },
  async getAdminEntitlement(id: number): Promise<AdminEntitlement | undefined> {
    const [e] = await db.select().from(adminEntitlements).where(eq(adminEntitlements.id, id));
    return e;
  },
  async createAdminEntitlement(entitlement: InsertAdminEntitlement): Promise<AdminEntitlement> {
    const [e] = await db.insert(adminEntitlements).values(entitlement as any).returning();
    return e;
  },
  async updateAdminEntitlement(id: number, updates: Partial<InsertAdminEntitlement>): Promise<AdminEntitlement> {
    const [e] = await db.update(adminEntitlements).set({ ...updates, updatedAt: new Date() } as any).where(eq(adminEntitlements.id, id)).returning();
    return e;
  },
  async deleteAdminEntitlement(id: number): Promise<void> {
    await db.delete(adminProductOverrides).where(eq(adminProductOverrides.entitlementId, id));
    await db.delete(adminProductEntitlements).where(eq(adminProductEntitlements.entitlementId, id));
    await db.delete(adminEntitlements).where(eq(adminEntitlements.id, id));
  },
};
