import { db } from "../db";
import { jobs, type Job, type InsertJob } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export const jobStorage = {
  async getJobs(): Promise<Job[]> {
    return await db.select().from(jobs).orderBy(desc(jobs.createdAt));
  },
  async getJob(id: number): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job;
  },
  async createJob(insertJob: InsertJob): Promise<Job> {
    const [job] = await db.insert(jobs).values(insertJob as any).returning();
    return job;
  },
  async updateJob(id: number, updates: Partial<InsertJob>): Promise<Job> {
    const [job] = await db.update(jobs).set(updates).where(eq(jobs.id, id)).returning();
    return job;
  },
  async deleteJob(id: number): Promise<void> {
    await db.delete(jobs).where(eq(jobs.id, id));
  },
};
