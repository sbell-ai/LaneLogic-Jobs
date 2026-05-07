import { db } from "../db";
import {
  jobImportRuns, jobs, jobSources,
  type JobImportRun, type InsertJobImportRun,
} from "@shared/schema";
import { eq, and, sql, desc, count } from "drizzle-orm";

export const jobImportRunStorage = {
  async createJobImportRun(run: InsertJobImportRun): Promise<JobImportRun> {
    const [r] = await db.insert(jobImportRuns).values(run as any).returning();
    return r;
  },
  async updateJobImportRun(id: number, updates: Partial<InsertJobImportRun>): Promise<JobImportRun> {
    const [r] = await db.update(jobImportRuns).set(updates).where(eq(jobImportRuns.id, id)).returning();
    return r;
  },
  async getJobImportRuns(sourceId?: number, limit: number = 50): Promise<JobImportRun[]> {
    if (sourceId !== undefined) {
      return await db.select().from(jobImportRuns).where(eq(jobImportRuns.sourceId, sourceId)).orderBy(desc(jobImportRuns.createdAt)).limit(limit);
    }
    return await db.select().from(jobImportRuns).orderBy(desc(jobImportRuns.createdAt)).limit(limit);
  },
  async getJobImportRun(id: number): Promise<JobImportRun | undefined> {
    const [r] = await db.select().from(jobImportRuns).where(eq(jobImportRuns.id, id));
    return r;
  },
  async getJobImportRunsFiltered(opts: { sourceId?: number; status?: string; dateFrom?: Date; dateTo?: Date; page: number; limit: number }): Promise<{ runs: (JobImportRun & { sourceName: string })[], total: number }> {
    const conditions: any[] = [];
    if (opts.sourceId !== undefined) conditions.push(eq(jobImportRuns.sourceId, opts.sourceId));
    if (opts.status) conditions.push(eq(jobImportRuns.status, opts.status));
    if (opts.dateFrom) conditions.push(sql`${jobImportRuns.createdAt} >= ${opts.dateFrom}`);
    if (opts.dateTo) conditions.push(sql`${jobImportRuns.createdAt} <= ${opts.dateTo}`);

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (opts.page - 1) * opts.limit;

    const [totalResult] = await db.select({ cnt: count() }).from(jobImportRuns).where(whereClause);
    const total = Number(totalResult?.cnt || 0);

    const rows = await db
      .select({
        id: jobImportRuns.id,
        sourceId: jobImportRuns.sourceId,
        status: jobImportRuns.status,
        startedAt: jobImportRuns.startedAt,
        finishedAt: jobImportRuns.finishedAt,
        apifyRunId: jobImportRuns.apifyRunId,
        apifyDatasetId: jobImportRuns.apifyDatasetId,
        actorInputJson: jobImportRuns.actorInputJson,
        statsCreated: jobImportRuns.statsCreated,
        statsUpdated: jobImportRuns.statsUpdated,
        statsSkipped: jobImportRuns.statsSkipped,
        statsExpired: jobImportRuns.statsExpired,
        warnings: jobImportRuns.warnings,
        lastError: jobImportRuns.lastError,
        createdAt: jobImportRuns.createdAt,
        sourceName: jobSources.name,
      })
      .from(jobImportRuns)
      .leftJoin(jobSources, eq(jobImportRuns.sourceId, jobSources.id))
      .where(whereClause)
      .orderBy(desc(jobImportRuns.createdAt))
      .limit(opts.limit)
      .offset(offset);

    return {
      runs: rows.map(r => ({ ...r, sourceName: r.sourceName ?? "Unknown" })),
      total,
    };
  },
  async getJobsForImportRun(runId: number): Promise<{ id: number; title: string; companyName: string | null; status: string | null; createdAt: Date | null; lastImportedAt: Date | null }[]> {
    const run = await jobImportRunStorage.getJobImportRun(runId);
    if (!run || !run.startedAt) return [];
    const windowEnd = run.finishedAt ?? new Date();
    const rows = await db
      .select({ id: jobs.id, title: jobs.title, companyName: jobs.companyName, status: jobs.status, createdAt: jobs.createdAt, lastImportedAt: jobs.lastImportedAt })
      .from(jobs)
      .where(and(
        eq(jobs.sourceId, run.sourceId),
        sql`${jobs.lastImportedAt} >= ${run.startedAt}`,
        sql`${jobs.lastImportedAt} <= ${windowEnd}`
      ))
      .orderBy(desc(jobs.createdAt))
      .limit(20);
    return rows;
  },
};
