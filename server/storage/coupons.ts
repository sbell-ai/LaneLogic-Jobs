import { db } from "../db";
import { coupons, type Coupon, type InsertCoupon } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

export const couponStorage = {
  async getCoupons(): Promise<Coupon[]> {
    return await db.select().from(coupons);
  },
  async getCoupon(id: number): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.id, id));
    return coupon;
  },
  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code));
    return coupon;
  },
  async createCoupon(coupon: InsertCoupon): Promise<Coupon> {
    const [c] = await db.insert(coupons).values(coupon as any).returning();
    return c;
  },
  async updateCoupon(id: number, updates: Partial<InsertCoupon>): Promise<Coupon> {
    const [c] = await db.update(coupons).set(updates).where(eq(coupons.id, id)).returning();
    return c;
  },
  async deleteCoupon(id: number): Promise<void> {
    await db.delete(coupons).where(eq(coupons.id, id));
  },
  async incrementCouponUses(id: number): Promise<void> {
    await db.update(coupons)
      .set({ currentUses: sql`${coupons.currentUses} + 1` } as any)
      .where(eq(coupons.id, id));
  },
};
