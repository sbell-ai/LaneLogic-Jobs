import { db } from "../db";
import {
  adminProducts, adminProductEntitlements, adminProductOverrides,
  type AdminProduct, type InsertAdminProduct,
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export const adminProductStorage = {
  async getAdminProducts(): Promise<AdminProduct[]> {
    return await db.select().from(adminProducts).orderBy(desc(adminProducts.createdAt));
  },
  async getAdminProduct(id: number): Promise<AdminProduct | undefined> {
    const [p] = await db.select().from(adminProducts).where(eq(adminProducts.id, id));
    return p;
  },
  async createAdminProduct(product: InsertAdminProduct): Promise<AdminProduct> {
    const [p] = await db.insert(adminProducts).values(product as any).returning();
    return p;
  },
  async updateAdminProduct(id: number, updates: Partial<InsertAdminProduct>): Promise<AdminProduct> {
    const [p] = await db.update(adminProducts).set({ ...updates, updatedAt: new Date() } as any).where(eq(adminProducts.id, id)).returning();
    return p;
  },
  async deleteAdminProduct(id: number): Promise<void> {
    await db.delete(adminProductEntitlements).where(eq(adminProductEntitlements.productId, id));
    await db.delete(adminProductOverrides).where(eq(adminProductOverrides.productId, id));
    await db.delete(adminProducts).where(eq(adminProducts.id, id));
  },
};
