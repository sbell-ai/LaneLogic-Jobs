import { db } from "../db";
import { resumes, type Resume, type InsertResume } from "@shared/schema";
import { eq } from "drizzle-orm";

export const resumeStorage = {
  async getResumes(jobSeekerId: number): Promise<Resume[]> {
    return await db.select().from(resumes).where(eq(resumes.jobSeekerId, jobSeekerId));
  },
  async createResume(resume: InsertResume): Promise<Resume> {
    const [res] = await db.insert(resumes).values(resume as any).returning();
    return res;
  },
};
