import { db } from "../db";
import {
  jobAlertSubscriptions,
  type JobAlertSubscription, type InsertJobAlertSubscription,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export const jobAlertStorage = {
  async getJobAlerts(userId: number): Promise<JobAlertSubscription[]> {
    return await db.select().from(jobAlertSubscriptions).where(eq(jobAlertSubscriptions.userId, userId)).orderBy(desc(jobAlertSubscriptions.createdAt));
  },

  async createJobAlert(data: InsertJobAlertSubscription): Promise<JobAlertSubscription> {
    const [alert] = await db.insert(jobAlertSubscriptions).values(data as any).returning();
    return alert;
  },

  async deleteJobAlert(id: number, userId: number): Promise<void> {
    await db.delete(jobAlertSubscriptions).where(and(eq(jobAlertSubscriptions.id, id), eq(jobAlertSubscriptions.userId, userId)));
  },

  async getAllJobAlerts(): Promise<JobAlertSubscription[]> {
    return await db.select().from(jobAlertSubscriptions);
  },

  async updateJobAlertNotifiedAt(id: number, notifiedAt: Date): Promise<void> {
    await db.update(jobAlertSubscriptions).set({ lastNotifiedAt: notifiedAt } as any).where(eq(jobAlertSubscriptions.id, id));
  },

  async updateJobAlert(id: number, userId: number, updates: { isActive?: boolean; name?: string }): Promise<JobAlertSubscription> {
    const [alert] = await db.update(jobAlertSubscriptions)
      .set(updates as any)
      .where(and(eq(jobAlertSubscriptions.id, id), eq(jobAlertSubscriptions.userId, userId)))
      .returning();
    return alert;
  },
};
