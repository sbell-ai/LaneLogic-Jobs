import { db } from "../db";
import { applications, type Application, type InsertApplication } from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";

export const applicationStorage = {
  async getApplications(): Promise<Application[]> {
    return await db.select().from(applications);
  },
  async updateApplication(id: number, updates: Partial<InsertApplication>): Promise<Application> {
    const [app] = await db.update(applications).set(updates).where(eq(applications.id, id)).returning();
    return app;
  },
  async deleteApplication(id: number): Promise<void> {
    await db.delete(applications).where(eq(applications.id, id));
  },
  async getApplicationsBySeeker(seekerId: number): Promise<Application[]> {
    return db.select().from(applications).where(eq(applications.jobSeekerId, seekerId)).orderBy(desc(applications.createdAt));
  },
  async markApplicationViewed(id: number): Promise<void> {
    await db.update(applications).set({ viewedAt: new Date() } as any).where(and(eq(applications.id, id), sql`viewed_at IS NULL`));
  },
  async createApplication(insertApp: InsertApplication, txDb: any = db): Promise<Application> {
    const [app] = await txDb.insert(applications).values(insertApp).returning();
    return app;
  },
};
