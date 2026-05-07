import { db } from "../db";
import {
  jobSources, jobImportRuns,
  type JobSource, type InsertJobSource,
} from "@shared/schema";
import { eq, and, sql, desc, inArray, count } from "drizzle-orm";

export const jobSourceStorage = {
  async getJobSources(): Promise<JobSource[]> {
    return await db.select().from(jobSources).orderBy(desc(jobSources.createdAt));
  },
  async getJobSource(id: number): Promise<JobSource | undefined> {
    const [s] = await db.select().from(jobSources).where(eq(jobSources.id, id));
    return s;
  },
  async createJobSource(source: InsertJobSource): Promise<JobSource> {
    const [s] = await db.insert(jobSources).values(source as any).returning();
    return s;
  },
  async updateJobSource(id: number, updates: Partial<InsertJobSource>): Promise<JobSource> {
    const [s] = await db.update(jobSources).set({ ...updates, updatedAt: new Date() } as any).where(eq(jobSources.id, id)).returning();
    return s;
  },
  async getActiveJobSourcesDueForPoll(): Promise<JobSource[]> {
    return await db.select().from(jobSources).where(
      and(
        eq(jobSources.status, "active"),
        sql`(${jobSources.lastRunAt} IS NULL OR ${jobSources.lastRunAt} < NOW() - (${jobSources.pollIntervalMinutes} || ' minutes')::interval)`
      )
    );
  },
  async claimJobSourceForRun(sourceId: number): Promise<boolean> {
    const rows = await db.update(jobSources)
      .set({ lastRunAt: new Date() } as any)
      .where(
        and(
          eq(jobSources.id, sourceId),
          eq(jobSources.status, "active"),
          sql`(${jobSources.lastRunAt} IS NULL OR ${jobSources.lastRunAt} < NOW() - (${jobSources.pollIntervalMinutes} || ' minutes')::interval)`
        )
      )
      .returning();
    return rows.length > 0;
  },
  async deleteJobSource(id: number): Promise<void> {
    await db.delete(jobSources).where(eq(jobSources.id, id));
  },
  async getActiveRunCountForSource(sourceId: number): Promise<number> {
    const [result] = await db.select({ cnt: count() }).from(jobImportRuns).where(
      and(eq(jobImportRuns.sourceId, sourceId), inArray(jobImportRuns.status, ["queued", "running"]))
    );
    return Number(result?.cnt || 0);
  },
};
