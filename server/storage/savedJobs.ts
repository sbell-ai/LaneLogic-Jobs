import { db } from "../db";
import { savedJobs, type SavedJob } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export const savedJobStorage = {
  async getSavedJobsBySeeker(seekerId: number): Promise<SavedJob[]> {
    return db.select().from(savedJobs).where(eq(savedJobs.jobSeekerId, seekerId)).orderBy(desc(savedJobs.createdAt));
  },
  async saveJob(seekerId: number, jobId: number): Promise<SavedJob> {
    const [row] = await db.insert(savedJobs).values({ jobSeekerId: seekerId, jobId }).onConflictDoNothing().returning();
    if (!row) {
      const existing = await db.select().from(savedJobs).where(and(eq(savedJobs.jobSeekerId, seekerId), eq(savedJobs.jobId, jobId)));
      return existing[0];
    }
    return row;
  },
  async unsaveJob(seekerId: number, jobId: number): Promise<void> {
    await db.delete(savedJobs).where(and(eq(savedJobs.jobSeekerId, seekerId), eq(savedJobs.jobId, jobId)));
  },
};
