import { db } from "../db";
import {
  applications, jobs, users,
  type Application,
} from "@shared/schema";
import { eq, inArray } from "drizzle-orm";

export const enrichedApplicantStorage = {
  async getEmployerApplicationsEnriched(employerId: number): Promise<(Application & { seekerName: string; seekerEmail: string; seekerVerificationStatus: string | null; employerNotes?: string | null })[]> {
    const myJobs = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.employerId, employerId));
    const jobIds = myJobs.map((j) => j.id);
    if (jobIds.length === 0) return [];

    const apps = await db.select().from(applications).where(inArray(applications.jobId, jobIds));
    const seekerIds = [...new Set(apps.map((a) => a.jobSeekerId))];
    const seekers =
      seekerIds.length > 0
        ? await db
            .select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName, seekerVerificationStatus: users.seekerVerificationStatus })
            .from(users)
            .where(inArray(users.id, seekerIds))
        : [];

    const seekerMap = new Map(seekers.map((s) => [s.id, s]));
    return apps.map((a) => {
      const seeker = seekerMap.get(a.jobSeekerId);
      const seekerName =
        seeker
          ? seeker.firstName && seeker.lastName
            ? `${seeker.firstName} ${seeker.lastName}`
            : seeker.email
          : `Applicant #${a.jobSeekerId}`;
      return { ...a, seekerName, seekerEmail: seeker?.email ?? "", seekerVerificationStatus: seeker?.seekerVerificationStatus ?? null };
    });
  },
};
