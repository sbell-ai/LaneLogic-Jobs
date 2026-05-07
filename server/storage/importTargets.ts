import { db } from "../db";
import {
  importTargets, jobs, jobSources,
  type ImportTarget, type InsertImportTarget,
} from "@shared/schema";
import { eq, and, sql, desc, ne, inArray, count } from "drizzle-orm";

export const importTargetStorage = {
  async getImportTargets(sourceId?: number): Promise<ImportTarget[]> {
    if (sourceId !== undefined) {
      return await db.select().from(importTargets).where(eq(importTargets.sourceId, sourceId)).orderBy(desc(importTargets.lastSeenAt));
    }
    return await db.select().from(importTargets).orderBy(desc(importTargets.lastSeenAt));
  },
  async getImportTarget(id: number): Promise<ImportTarget | undefined> {
    const [t] = await db.select().from(importTargets).where(eq(importTargets.id, id));
    return t;
  },
  async upsertImportTarget(sourceId: number, sourceDomain: string, companyName: string, employerWebsiteDomain?: string | null): Promise<ImportTarget> {
    const existing = await db.select().from(importTargets).where(
      and(eq(importTargets.sourceId, sourceId), eq(importTargets.sourceDomain, sourceDomain))
    );
    if (existing.length > 0) {
      const updates: any = { companyName, lastSeenAt: new Date() };
      if (employerWebsiteDomain) updates.employerWebsiteDomain = employerWebsiteDomain;
      const [t] = await db.update(importTargets).set(updates).where(eq(importTargets.id, existing[0].id)).returning();
      return t;
    }
    const [t] = await db.insert(importTargets).values({
      sourceId, sourceDomain, companyName,
      employerWebsiteDomain: employerWebsiteDomain || null,
      status: "pending_review",
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
    } as any).returning();
    return t;
  },
  async updateImportTarget(id: number, updates: Partial<InsertImportTarget>): Promise<ImportTarget> {
    const [t] = await db.update(importTargets).set(updates).where(eq(importTargets.id, id)).returning();
    return t;
  },
  async getJobCountByImportTarget(importTargetId: number): Promise<number> {
    const [result] = await db.select({ cnt: count() }).from(jobs).where(
      and(eq(jobs.importTargetId, importTargetId), ne(jobs.status, "expired"))
    );
    return Number(result?.cnt || 0);
  },
  async getPendingImportTargetsCount(): Promise<number> {
    const [result] = await db.select({ cnt: count() }).from(importTargets).where(eq(importTargets.status, "pending_review"));
    return Number(result?.cnt || 0);
  },
  async bulkUpdateImportTargets(ids: number[], status: string): Promise<number> {
    if (ids.length === 0) return 0;
    const rows = await db.update(importTargets).set({ status } as any).where(inArray(importTargets.id, ids)).returning();
    return rows.length;
  },
  async getImportTargetsWithSource(sourceId?: number): Promise<(ImportTarget & { sourceName: string; jobCount: number })[]> {
    const rows = await db
      .select({
        id: importTargets.id,
        sourceId: importTargets.sourceId,
        sourceDomain: importTargets.sourceDomain,
        companyName: importTargets.companyName,
        employerWebsiteDomain: importTargets.employerWebsiteDomain,
        status: importTargets.status,
        firstSeenAt: importTargets.firstSeenAt,
        lastSeenAt: importTargets.lastSeenAt,
        sourceName: jobSources.name,
      })
      .from(importTargets)
      .leftJoin(jobSources, eq(importTargets.sourceId, jobSources.id))
      .where(sourceId !== undefined ? eq(importTargets.sourceId, sourceId) : undefined)
      .orderBy(desc(importTargets.lastSeenAt));

    const withCounts = await Promise.all(rows.map(async (row) => {
      const jobCount = await importTargetStorage.getJobCountByImportTarget(row.id);
      return { ...row, sourceName: row.sourceName ?? "Unknown", jobCount };
    }));
    return withCounts;
  },
};
