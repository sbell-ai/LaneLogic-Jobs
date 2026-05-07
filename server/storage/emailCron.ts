import { db } from "../db";
import {
  emailCronConfigs,
  type EmailCronConfig, type InsertEmailCronConfig,
} from "@shared/schema";
import { eq, asc } from "drizzle-orm";

export const emailCronStorage = {
  async getEmailCronConfigs(): Promise<EmailCronConfig[]> {
    return await db.select().from(emailCronConfigs).orderBy(asc(emailCronConfigs.name));
  },

  async getEmailCronConfig(id: number): Promise<EmailCronConfig | undefined> {
    const [c] = await db.select().from(emailCronConfigs).where(eq(emailCronConfigs.id, id));
    return c;
  },

  async getEmailCronConfigByName(name: string): Promise<EmailCronConfig | undefined> {
    const [c] = await db.select().from(emailCronConfigs).where(eq(emailCronConfigs.name, name));
    return c;
  },

  async createEmailCronConfig(config: InsertEmailCronConfig): Promise<EmailCronConfig> {
    const [c] = await db.insert(emailCronConfigs).values({ ...config, updatedAt: new Date() } as any).returning();
    return c;
  },

  async updateEmailCronConfig(id: number, updates: Partial<InsertEmailCronConfig>): Promise<EmailCronConfig> {
    const [c] = await db
      .update(emailCronConfigs)
      .set({ ...updates, updatedAt: new Date() } as any)
      .where(eq(emailCronConfigs.id, id))
      .returning();
    return c;
  },

  async deleteEmailCronConfig(id: number): Promise<void> {
    await db.delete(emailCronConfigs).where(eq(emailCronConfigs.id, id));
  },

  async touchEmailCronConfigLastRun(id: number): Promise<void> {
    await db
      .update(emailCronConfigs)
      .set({ lastRunAt: new Date(), updatedAt: new Date() } as any)
      .where(eq(emailCronConfigs.id, id));
  },
};
