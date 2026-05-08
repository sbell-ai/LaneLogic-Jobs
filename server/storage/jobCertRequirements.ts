import { db } from "../db";
import { jobCertRequirements, type JobCertRequirements } from "@shared/schema";
import { jobCertRequirementsSchema } from "@shared/certEnums";
import { eq } from "drizzle-orm";
import { z } from "zod";

type JobCertReqInput = z.infer<typeof jobCertRequirementsSchema>;

function normalizeClass(c: JobCertReqInput["cdlClassRequired"]): "A" | "B" | "C" | null {
  if (!c || c === "none") return null;
  return c;
}

export const jobCertStorage = {
  async getCertRequirements(jobId: number): Promise<JobCertRequirements | null> {
    const rows = await db.select().from(jobCertRequirements).where(eq(jobCertRequirements.jobId, jobId));
    return rows[0] ?? null;
  },

  async upsertCertRequirements(jobId: number, data: JobCertReqInput): Promise<JobCertRequirements> {
    const values = {
      jobId,
      cdlRequired: data.cdlRequired,
      cdlClassRequired: normalizeClass(data.cdlClassRequired),
      cdlEndorsementsRequired: data.cdlEndorsementsRequired,
      cdlRestrictionsAllowed: data.cdlRestrictionsAllowed,
      minYearsExperience: data.minYearsExperience ?? null,
    };
    const [row] = await db
      .insert(jobCertRequirements)
      .values(values)
      .onConflictDoUpdate({
        target: jobCertRequirements.jobId,
        set: {
          cdlRequired: values.cdlRequired,
          cdlClassRequired: values.cdlClassRequired,
          cdlEndorsementsRequired: values.cdlEndorsementsRequired,
          cdlRestrictionsAllowed: values.cdlRestrictionsAllowed,
          minYearsExperience: values.minYearsExperience,
        },
      })
      .returning();
    return row;
  },
};
