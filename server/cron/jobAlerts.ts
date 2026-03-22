/**
 * Job Alert Cron — Task #51
 *
 * Runs every 15 minutes. For each active job alert subscription, finds jobs
 * posted since the alert's last_notified_at (or 24 hours ago if never notified),
 * and sends a digest email if any matches exist.
 *
 * Matching logic:
 *   - keyword: matches job title or description (case-insensitive substring)
 *   - category: matches job.category
 *   - locationState: matches job.location_state
 *   - jobType: matches job.job_type
 *
 * Only sends to seekers who have job_alerts notifications enabled (notification_preferences.job_alerts).
 */

import { storage } from "../storage";
import { db } from "../db";
import { jobs, users } from "@shared/schema";
import { eq, and, gte, isNull, or, ilike } from "drizzle-orm";
import { sendTemplatedEmail } from "../email/sendTemplatedEmail";

const SITE_NAME = "LaneLogic Jobs";
const SITE_URL = process.env.CANONICAL_HOST || "https://lanelogicjobs.com";
const CHECK_WINDOW_HOURS = 24;

function buildAlertLabel(alert: {
  name?: string | null;
  keyword?: string | null;
  category?: string | null;
  locationState?: string | null;
  jobType?: string | null;
  workLocationType?: string | null;
}): string {
  if (alert.name) return alert.name;
  const parts: string[] = [];
  if (alert.keyword) parts.push(`"${alert.keyword}"`);
  if (alert.category) parts.push(alert.category);
  if (alert.locationState) parts.push(alert.locationState);
  if (alert.jobType) parts.push(alert.jobType);
  if (alert.workLocationType) parts.push(alert.workLocationType);
  return parts.length > 0 ? parts.join(" · ") : "All jobs";
}

function buildJobsUrl(alert: {
  keyword?: string | null;
  category?: string | null;
  locationState?: string | null;
  jobType?: string | null;
}): string {
  const params = new URLSearchParams();
  if (alert.keyword) params.set("q", alert.keyword);
  const qs = params.toString();
  return `${SITE_URL}/jobs${qs ? `?${qs}` : ""}`;
}

export async function runJobAlertCron(): Promise<void> {
  try {
    const allAlerts = await storage.getAllJobAlerts();
    const activeAlerts = allAlerts.filter((a) => a.isActive);

    if (activeAlerts.length === 0) return;

    const cutoffDefault = new Date(Date.now() - CHECK_WINDOW_HOURS * 60 * 60 * 1000);

    for (const alert of activeAlerts) {
      try {
        const since = alert.lastNotifiedAt ?? cutoffDefault;

        // Fetch published jobs posted since the last notification
        const baseConditions = [
          eq(jobs.isPublished, true),
          gte(jobs.createdAt, since),
        ];
        if (alert.category) {
          baseConditions.push(eq(jobs.category, alert.category));
        }
        if (alert.locationState) {
          baseConditions.push(eq(jobs.locationState, alert.locationState));
        }
        if (alert.jobType) {
          baseConditions.push(eq(jobs.jobType, alert.jobType));
        }

        let matchingJobs = await db
          .select({
            id: jobs.id,
            title: jobs.title,
            companyName: jobs.companyName,
            locationCity: jobs.locationCity,
            locationState: jobs.locationState,
          })
          .from(jobs)
          .where(and(...baseConditions));

        // Keyword filter (title match) applied in-memory for simplicity
        if (alert.keyword) {
          const kw = alert.keyword.toLowerCase();
          matchingJobs = matchingJobs.filter(
            (j) => j.title?.toLowerCase().includes(kw)
          );
        }

        if (matchingJobs.length === 0) continue;

        // Load the seeker's user record
        const [seeker] = await db
          .select({ id: users.id, email: users.email, firstName: users.firstName, notificationPreferences: users.notificationPreferences })
          .from(users)
          .where(eq(users.id, alert.userId));

        if (!seeker) continue;

        // Check notification preferences
        const prefs = seeker.notificationPreferences as Record<string, boolean> | null;
        if (prefs && prefs.job_alerts === false) continue;

        const alertLabel = buildAlertLabel(alert);
        const jobListings = matchingJobs
          .slice(0, 10)
          .map((j) => {
            const loc = [j.locationCity, j.locationState].filter(Boolean).join(", ");
            return `• ${j.title}${j.companyName ? ` at ${j.companyName}` : ""}${loc ? ` (${loc})` : ""}`;
          })
          .join("\n");

        await sendTemplatedEmail("job_alert", seeker.email, {
          first_name: seeker.firstName || "there",
          alert_label: alertLabel,
          job_listings: jobListings,
          jobs_url: buildJobsUrl(alert),
          alerts_url: `${SITE_URL}/dashboard/alerts`,
          site_name: SITE_NAME,
          site_url: SITE_URL,
        });

        await storage.updateJobAlertNotifiedAt(alert.id, new Date());
      } catch (alertErr) {
        console.error(`[job-alert-cron] Error processing alert ${alert.id}:`, alertErr);
      }
    }
  } catch (err) {
    console.error("[job-alert-cron] Fatal error:", err);
  }
}

export function initJobAlertCron(): void {
  const INTERVAL_MS = 15 * 60 * 1000; // every 15 minutes
  console.log("[job-alert-cron] Initialized — running every 15 minutes");
  setInterval(runJobAlertCron, INTERVAL_MS);
  // Also run once on startup after a short delay
  setTimeout(runJobAlertCron, 5000);
}
