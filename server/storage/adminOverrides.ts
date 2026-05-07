import { db } from "../db";
import {
  adminProductOverrides,
  type AdminProductOverride, type InsertAdminProductOverride,
} from "@shared/schema";
import { eq } from "drizzle-orm";

export const adminOverrideStorage = {
  async getAdminProductOverrides(productId?: number): Promise<AdminProductOverride[]> {
    if (productId !== undefined) {
      return await db.select().from(adminProductOverrides).where(eq(adminProductOverrides.productId, productId));
    }
    return await db.select().from(adminProductOverrides);
  },
  async getAdminProductOverride(id: number): Promise<AdminProductOverride | undefined> {
    const [o] = await db.select().from(adminProductOverrides).where(eq(adminProductOverrides.id, id));
    return o;
  },
  async createAdminProductOverride(override: InsertAdminProductOverride): Promise<AdminProductOverride> {
    const [o] = await db.insert(adminProductOverrides).values(override as any).returning();
    return o;
  },
  async updateAdminProductOverride(id: number, updates: Partial<InsertAdminProductOverride>): Promise<AdminProductOverride> {
    const [o] = await db.update(adminProductOverrides).set({ ...updates, updatedAt: new Date() } as any).where(eq(adminProductOverrides.id, id)).returning();
    return o;
  },
  async deleteAdminProductOverride(id: number): Promise<void> {
    await db.delete(adminProductOverrides).where(eq(adminProductOverrides.id, id));
  },
};
