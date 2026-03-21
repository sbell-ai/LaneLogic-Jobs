/**
 * Scheduled email cron jobs.
 *
 * Three jobs run once per day (every 24 hours):
 *   1. feature_expiring  — users whose resumeAccessExpiresAt or featuredEmployerExpiresAt
 *                          falls within the next 6–8 days.
 *   2. job_expiring      — published jobs whose expiresAt falls within the next 6–8 days.
 *   3. profile_incomplete_reminder — job seekers with incomplete profiles whose accounts
 *                          are 3–4 days old (one reminder, no duplicate-send tracking needed).
 *
 * The 6–8-day window ensures each item triggers exactly one notification per weekly run
 * without a separate "sent" tracking table.
 */

import { db } from "../db";
import { users, jobs } from "@shared/schema";
import { and, eq, gte, lte, isNotNull, or, ne } from "drizzle-orm";
import { sendTemplatedEmailByEvent } from "../email/sendTemplatedEmail.ts";

const SITE_NAME = "LaneLogic Jobs";
const SITE_URL = process.env.CANONICAL_HOST || "https://lanelogicjobs.com";

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// ── 1. Feature / Plan Expiring ────────────────────────────────────────────────

async function runFeatureExpiringCron(): Promise<void> {
  const now = new Date();
  const windowStart = addDays(now, 6);
  const windowEnd = addDays(now, 8);

  try {
    const expiringUsers = await db
      .select()
      .from(users)
      .where(
        or(
          and(
            isNotNull(users.resumeAccessExpiresAt),
            gte(users.resumeAccessExpiresAt, windowStart),
            lte(users.resumeAccessExpiresAt, windowEnd),
          ),
          and(
            isNotNull(users.featuredEmployerExpiresAt),
            gte(users.featuredEmployerExpiresAt, windowStart),
            lte(users.featuredEmployerExpiresAt, windowEnd),
          ),
        ),
      );

    let sent = 0;
    for (const user of expiringUsers) {
      const features: { name: string; expiryDate: Date }[] = [];

      if (
        user.resumeAccessExpiresAt &&
        user.resumeAccessExpiresAt >= windowStart &&
        user.resumeAccessExpiresAt <= windowEnd
      ) {
        features.push({ name: "Resume Access", expiryDate: user.resumeAccessExpiresAt });
      }
      if (
        user.featuredEmployerExpiresAt &&
        user.featuredEmployerExpiresAt >= windowStart &&
        user.featuredEmployerExpiresAt <= windowEnd
      ) {
        features.push({ name: "Featured Employer Listing", expiryDate: user.featuredEmployerExpiresAt });
      }

      for (const feature of features) {
        try {
          await sendTemplatedEmailByEvent("feature_expiring", user.email, {
            first_name: user.firstName || user.email,
            feature_name: feature.name,
            expiry_date: formatDate(feature.expiryDate),
            site_name: SITE_NAME,
            site_url: SITE_URL,
            dashboard_url: `${SITE_URL}/dashboard`,
          });
          sent++;
        } catch (e: any) {
          console.error(`[cron:feature_expiring] Error for user ${user.id}:`, e?.message);
        }
      }
    }

    console.log(`[cron:feature_expiring] Scanned ${expiringUsers.length} users, sent ${sent} emails`);
  } catch (e: any) {
    console.error("[cron:feature_expiring] Query error:", e?.message);
  }
}

// ── 2. Job Listing Expiring ───────────────────────────────────────────────────

async function runJobExpiringCron(): Promise<void> {
  const now = new Date();
  const windowStart = addDays(now, 6);
  const windowEnd = addDays(now, 8);

  try {
    const expiringJobs = await db
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.isPublished, true),
          isNotNull(jobs.expiresAt),
          gte(jobs.expiresAt, windowStart),
          lte(jobs.expiresAt, windowEnd),
        ),
      );

    let sent = 0;
    for (const job of expiringJobs) {
      try {
        const [employer] = await db
          .select()
          .from(users)
          .where(eq(users.id, job.employerId))
          .limit(1);

        if (!employer) continue;

        await sendTemplatedEmailByEvent("job_expiring", employer.email, {
          first_name: employer.firstName || employer.companyName || employer.email,
          company_name: job.companyName || employer.companyName || "",
          job_title: job.title,
          expiry_date: formatDate(job.expiresAt!),
          renew_url: `${SITE_URL}/dashboard/jobs`,
          dashboard_url: `${SITE_URL}/dashboard`,
          site_name: SITE_NAME,
          site_url: SITE_URL,
        });
        sent++;
      } catch (e: any) {
        console.error(`[cron:job_expiring] Error for job ${job.id}:`, e?.message);
      }
    }

    console.log(`[cron:job_expiring] Scanned ${expiringJobs.length} jobs, sent ${sent} emails`);
  } catch (e: any) {
    console.error("[cron:job_expiring] Query error:", e?.message);
  }
}

// ── 3. Incomplete Profile Reminder ───────────────────────────────────────────
// Targets job seekers who registered 3–4 days ago and still have key fields missing.
// The 3–4-day window acts as natural deduplication: each account falls in it exactly once.

const PROFILE_FIELDS: { field: keyof typeof users.$inferSelect; label: string }[] = [
  { field: "firstName", label: "First name" },
  { field: "lastName", label: "Last name" },
  { field: "seekerTrack", label: "Job track / category" },
];

async function runProfileIncompleteReminderCron(): Promise<void> {
  const now = new Date();
  const windowStart = addDays(now, -4);
  const windowEnd = addDays(now, -3);

  try {
    const candidates = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.role, "job_seeker"),
          isNotNull(users.createdAt),
          gte(users.createdAt, windowStart),
          lte(users.createdAt, windowEnd),
        ),
      );

    let sent = 0;
    for (const user of candidates) {
      const missingLabels: string[] = [];

      for (const { field, label } of PROFILE_FIELDS) {
        const val = user[field] as string | null | undefined;
        if (!val || val === "Unknown") missingLabels.push(label);
      }

      if (missingLabels.length === 0) continue;

      try {
        await sendTemplatedEmailByEvent("profile_incomplete_reminder", user.email, {
          first_name: user.firstName || user.email,
          missing_fields: missingLabels.join(", "),
          profile_url: `${SITE_URL}/dashboard/profile`,
          site_name: SITE_NAME,
          site_url: SITE_URL,
        });
        sent++;
      } catch (e: any) {
        console.error(`[cron:profile_incomplete_reminder] Error for user ${user.id}:`, e?.message);
      }
    }

    console.log(`[cron:profile_incomplete_reminder] Scanned ${candidates.length} seekers, sent ${sent} emails`);
  } catch (e: any) {
    console.error("[cron:profile_incomplete_reminder] Query error:", e?.message);
  }
}

// ── Scheduler ────────────────────────────────────────────────────────────────

const CRON_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function runAllCronJobs(): Promise<void> {
  console.log("[cron:scheduled-emails] Running daily email cron jobs...");
  await runFeatureExpiringCron();
  await runJobExpiringCron();
  await runProfileIncompleteReminderCron();
  console.log("[cron:scheduled-emails] Daily email cron jobs complete");
}

/**
 * Start the scheduled email cron jobs.
 * Runs once at startup (after a short delay) then every 24 hours aligned to midnight UTC.
 */
export function initEmailCronJobs(): void {
  // Run for the first time shortly after startup
  setTimeout(() => {
    runAllCronJobs().catch((e) =>
      console.error("[cron:scheduled-emails] Startup run error:", e?.message),
    );
  }, 60_000); // 1 minute after boot

  // Schedule next run at the next UTC midnight, then repeat every 24h
  const now = new Date();
  const nextMidnightUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0),
  );
  const msUntilMidnight = nextMidnightUTC.getTime() - now.getTime();

  setTimeout(() => {
    runAllCronJobs().catch((e) =>
      console.error("[cron:scheduled-emails] Midnight run error:", e?.message),
    );
    setInterval(() => {
      runAllCronJobs().catch((e) =>
        console.error("[cron:scheduled-emails] Interval run error:", e?.message),
      );
    }, CRON_INTERVAL_MS);
  }, msUntilMidnight);

  console.log(
    `[cron:scheduled-emails] Initialized. Next midnight run in ${Math.round(msUntilMidnight / 60_000)} minutes.`,
  );
}
