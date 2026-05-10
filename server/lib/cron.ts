// Sprint 6 — scheduled jobs.
//   Daily at 08:00 UTC: scan seekerCertProfiles for credentials expiring
//   within 30 days and send dedup'd expiry-warning emails.
//
// Registered from server/index.ts on startup.

import cron from "node-cron";
import { and, eq, gte, isNotNull, lte } from "drizzle-orm";
import { db } from "../db";
import { credentialTypes, seekerCertProfiles, users } from "@shared/schema";
import { sendExpiryWarningEmail } from "./emailNotifications";
import { runSeedAgent } from "./seedAgent";

const EXPIRY_LOOKAHEAD_DAYS = 30;
const DAILY_EXPIRY_CHECK_CRON = "0 8 * * *"; // 08:00 UTC daily
const DAILY_SEED_AGENT_CRON = "0 6 * * *"; // 06:00 UTC daily

function fmtYearMonth(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function fmtDisplayDate(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function cdlClassToCode(cdlClass: string | null): string | null {
  if (!cdlClass) return null;
  return `CDL_CLASS_${cdlClass}`;
}

export async function runExpiryCheck(): Promise<{ scanned: number; sent: number }> {
  const now = new Date();
  const cutoff = new Date(now.getTime() + EXPIRY_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      userId: seekerCertProfiles.userId,
      cdlClass: seekerCertProfiles.cdlClass,
      cdlExpiresAt: seekerCertProfiles.cdlExpiresAt,
      email: users.email,
      firstName: users.firstName,
    })
    .from(seekerCertProfiles)
    .innerJoin(users, eq(seekerCertProfiles.userId, users.id))
    .where(
      and(
        isNotNull(seekerCertProfiles.cdlExpiresAt),
        gte(seekerCertProfiles.cdlExpiresAt, now),
        lte(seekerCertProfiles.cdlExpiresAt, cutoff),
      ),
    );

  let sent = 0;
  for (const r of rows) {
    if (!r.cdlExpiresAt || !r.cdlClass) continue;
    const code = cdlClassToCode(r.cdlClass);
    if (!code) continue;
    const [credType] = await db
      .select({ name: credentialTypes.name })
      .from(credentialTypes)
      .where(eq(credentialTypes.code, code))
      .limit(1);
    const credentialName = credType?.name ?? `CDL Class ${r.cdlClass}`;

    await sendExpiryWarningEmail({
      userId: r.userId,
      to: r.email,
      credentialCode: code,
      expiryYearMonth: fmtYearMonth(r.cdlExpiresAt),
      vars: {
        firstName: r.firstName,
        credentialName,
        expiryDate: fmtDisplayDate(r.cdlExpiresAt),
      },
    });
    sent++;
  }
  return { scanned: rows.length, sent };
}

export function registerCronJobs(): void {
  cron.schedule(
    DAILY_EXPIRY_CHECK_CRON,
    () => {
      runExpiryCheck()
        .then((r) => console.log(`[cron] expiry check finished: scanned=${r.scanned} sent=${r.sent}`))
        .catch((err) => console.error("[cron] expiry check failed:", err));
    },
    { timezone: "UTC" },
  );
  console.log("[cron] expiry check registered (daily 08:00 UTC)");

  cron.schedule(
    DAILY_SEED_AGENT_CRON,
    () => {
      console.log("[cron] seed agent starting");
      runSeedAgent("cron")
        .then((r) =>
          console.log(
            `[cron] seed agent complete — inserted: ${r.total_inserted}, skipped: ${r.total_skipped}, errors: ${r.total_errors}`,
          ),
        )
        .catch((err) => console.error("[cron] seed agent failed:", err));
    },
    { timezone: "UTC" },
  );
  console.log("[cron] seed agent registered (daily 06:00 UTC)");
}
