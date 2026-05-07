import { db } from "../db";
import {
  jobs, importRuns, importArtifacts,
  type Job, type InsertJob,
  type ImportRun, type InsertImportRun,
  type ImportArtifact, type InsertImportArtifact,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export const importRunStorage = {
  async upsertJobByExternalKey(employerId: number, externalJobKey: string, job: InsertJob): Promise<Job> {
    const existing = await db.select().from(jobs).where(
      and(eq(jobs.employerId, employerId), eq(jobs.externalJobKey, externalJobKey))
    );
    if (existing.length > 0) {
      const { employerId: _eid, externalJobKey: _ek, ...updates } = job as any;
      const [updated] = await db.update(jobs).set(updates as any).where(eq(jobs.id, existing[0].id)).returning();
      return updated;
    }
    const [created] = await db.insert(jobs).values(job as any).returning();
    return created;
  },
  async createImportRun(run: InsertImportRun): Promise<ImportRun> {
    const [r] = await db.insert(importRuns).values(run as any).returning();
    return r;
  },
  async updateImportRun(id: number, updates: Partial<InsertImportRun>): Promise<ImportRun> {
    const [r] = await db.update(importRuns).set(updates).where(eq(importRuns.id, id)).returning();
    return r;
  },
  async getImportRun(id: number): Promise<ImportRun | undefined> {
    const [r] = await db.select().from(importRuns).where(eq(importRuns.id, id));
    return r;
  },
  async getImportRuns(): Promise<ImportRun[]> {
    return await db.select().from(importRuns).orderBy(desc(importRuns.uploadedAt));
  },
  async createImportArtifact(artifact: InsertImportArtifact): Promise<ImportArtifact> {
    const [a] = await db.insert(importArtifacts).values(artifact as any).returning();
    return a;
  },
  async getImportArtifact(runId: number, filename: string): Promise<ImportArtifact | undefined> {
    const [a] = await db.select().from(importArtifacts).where(
      and(eq(importArtifacts.runId, runId), eq(importArtifacts.filename, filename))
    );
    return a;
  },
};
