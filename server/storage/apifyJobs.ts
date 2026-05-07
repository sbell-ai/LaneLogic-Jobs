import { db } from "../db";
import {
  jobs,
  type Job, type InsertJob,
} from "@shared/schema";
import { eq, and, sql, ne, notInArray } from "drizzle-orm";

export const apifyJobStorage = {
  async upsertImportedJob(sourceId: number, importTargetId: number, externalJobId: string, _jobData: Partial<InsertJob>): Promise<{ job: Job; action: "created" | "updated" | "skipped" }> {
    const jobData = _jobData as any;
    const [existing] = await db.select().from(jobs).where(
      and(
        eq(jobs.sourceId, sourceId),
        eq(jobs.importTargetId, importTargetId),
        eq(jobs.externalJobId, externalJobId)
      )
    );
    const now = new Date();
    if (!existing) {
      const [job] = await db.insert(jobs).values({
        employerId: 0,
        title: jobData.title || "Untitled",
        description: jobData.description || "",
        requirements: jobData.requirements || "",
        companyName: jobData.companyName,
        jobType: jobData.jobType,
        locationCity: jobData.locationCity,
        locationState: jobData.locationState,
        locationCountry: jobData.locationCountry,
        applyUrl: jobData.applyUrl,
        isExternalApply: true,
        isPublished: false,
        sourceId,
        importTargetId,
        externalJobId,
        sourceUrl: jobData.sourceUrl,
        externalPostedAt: jobData.externalPostedAt,
        externalCreatedAt: jobData.externalCreatedAt,
        externalValidThrough: jobData.externalValidThrough,
        employmentType: jobData.employmentType,
        isRemote: jobData.isRemote,
        workLocationType: jobData.workLocationType,
        status: "draft",
        importedAt: now,
        lastImportedAt: now,
        rawSourceSnippet: jobData.rawSourceSnippet,
      } as any).returning();
      return { job, action: "created" };
    }

    const safeUpdates: any = {
      sourceUrl: jobData.sourceUrl,
      externalPostedAt: jobData.externalPostedAt,
      externalCreatedAt: jobData.externalCreatedAt,
      externalValidThrough: jobData.externalValidThrough,
      locationCity: jobData.locationCity,
      locationState: jobData.locationState,
      locationCountry: jobData.locationCountry,
      employmentType: jobData.employmentType,
      isRemote: jobData.isRemote,
      workLocationType: jobData.workLocationType,
      lastImportedAt: now,
      rawSourceSnippet: jobData.rawSourceSnippet,
    };
    if (existing.status === "expired") {
      safeUpdates.status = "draft";
    }
    if (!existing.lastAdminEditedAt) {
      if (jobData.title) safeUpdates.title = jobData.title;
      if (jobData.description) safeUpdates.description = jobData.description;
    }

    const [job] = await db.update(jobs).set(safeUpdates).where(eq(jobs.id, existing.id)).returning();
    return { job, action: "updated" };
  },

  async expireJobsNotInSet(importTargetId: number, seenExternalJobIds: string[]): Promise<number> {
    const conditions = [
      eq(jobs.importTargetId, importTargetId),
      ne(jobs.status, "expired"),
    ];
    if (seenExternalJobIds.length > 0) {
      conditions.push(sql`${jobs.externalJobId} IS NOT NULL`);
      conditions.push(notInArray(jobs.externalJobId, seenExternalJobIds));
    }
    const rows = await db.update(jobs)
      .set({ status: "expired", isPublished: false } as any)
      .where(and(...conditions))
      .returning();
    return rows.length;
  },

  async expireJobsByImportTarget(importTargetId: number): Promise<number> {
    const rows = await db.update(jobs)
      .set({ status: "expired", isPublished: false } as any)
      .where(and(eq(jobs.importTargetId, importTargetId), ne(jobs.status, "expired")))
      .returning();
    return rows.length;
  },
};
