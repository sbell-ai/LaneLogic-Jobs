// Sprint 7 — Writer layer for the AI job-seeding agent.
//
// Takes a NormalizedJob (from jobNormalizer), checks dedup, persists the job
// + its credential requirements, and kicks off match-score recompute.
// Errors are swallowed and reported via the return value — the orchestrator
// must keep walking the queue even if individual postings blow up.

import Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "../db";
import {
  credentialTypes,
  jobCredentialRequirements,
  jobs,
  users,
} from "@shared/schema";
import {
  type NormalizedJob,
  type SeedErrorEntry,
  type SeedSource,
} from "../../shared/seedTypes";
import { recalculateMatchScoresForJob } from "../utils/matchRecalc";

// Single internal employer that owns every seeded posting. The actual
// company name lives in jobs.company_name; this user just satisfies the
// jobs.employer_id NOT NULL constraint and gives us a clean way to filter
// agent-owned rows out of employer dashboards.
const SEED_EMPLOYER_EMAIL = "seed-agent@lanelogics.internal";
const SEED_EMPLOYER_USERNAME = "lanelogics-seed-agent";

const DEDUP_LOOKBACK_DAYS = 30;
const DEDUP_MODEL = "claude-sonnet-4-6";

let cachedSeedEmployerId: number | null = null;

async function getOrCreateSeedEmployerUserId(): Promise<number> {
  if (cachedSeedEmployerId !== null) return cachedSeedEmployerId;

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, SEED_EMPLOYER_EMAIL))
    .limit(1);

  if (existing) {
    cachedSeedEmployerId = existing.id;
    return existing.id;
  }

  // password is required NOT NULL; we put a non-loginable sentinel here
  // (no auth flow ever resolves "!seed-agent" as a hash).
  const [created] = await db
    .insert(users)
    .values({
      email: SEED_EMPLOYER_EMAIL,
      password: "!seed-agent-no-login",
      role: "employer",
      username: SEED_EMPLOYER_USERNAME,
      firstName: "LaneLogics",
      lastName: "Seed Agent",
      companyName: null,
      emailVerified: true,
      verificationStatus: "verified",
    } as any)
    .returning({ id: users.id });

  cachedSeedEmployerId = created.id;
  return created.id;
}

// "Dallas, TX" → { city: "Dallas", state: "TX" }
function splitLocation(text: string): { city: string | null; state: string | null } {
  const m = text.match(/^([^,]+),\s*([A-Z]{2})$/);
  if (!m) return { city: text || null, state: null };
  return { city: m[1].trim(), state: m[2].trim() };
}

// AI dedup is intentionally narrow: it only fires when the primary source_hash
// dedup said "different posting" but the company + location match an existing
// job from the last 30 days — i.e. a likely title-variation duplicate.
async function isAISemanticDuplicate(job: NormalizedJob): Promise<boolean> {
  if (process.env.SEED_AI_DEDUP === "false") return false;
  if (!process.env.ANTHROPIC_API_KEY) return false;

  const lookbackStart = new Date(Date.now() - DEDUP_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const candidates = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      companyName: jobs.companyName,
      locationCity: jobs.locationCity,
      locationState: jobs.locationState,
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.isSeeded, true),
        sql`lower(${jobs.companyName}) = lower(${job.company_name})`,
        gte(jobs.createdAt, lookbackStart),
      ),
    )
    .limit(10);

  if (candidates.length === 0) return false;

  const { city, state } = splitLocation(job.location_text);
  const sameLocation = candidates.filter(
    (c) =>
      (c.locationCity ?? "").toLowerCase() === (city ?? "").toLowerCase() &&
      (c.locationState ?? "").toLowerCase() === (state ?? "").toLowerCase(),
  );
  if (sameLocation.length === 0) return false;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  for (const c of sameLocation) {
    try {
      const resp = await client.messages.create({
        model: DEDUP_MODEL,
        max_tokens: 8,
        messages: [
          {
            role: "user",
            content:
              "Are these two job postings for the same position?\n" +
              `Job A: ${c.title} at ${c.companyName} in ${c.locationCity}, ${c.locationState}\n` +
              `Job B: ${job.title} at ${job.company_name} in ${job.location_text}\n` +
              "Respond with only: YES or NO",
          },
        ],
      });
      const text = resp.content.find((b) => b.type === "text");
      if (text?.type === "text" && /\bYES\b/i.test(text.text)) {
        return true;
      }
    } catch (err) {
      console.warn("[seeder] AI dedup call failed (treating as not-dup):", err);
    }
  }
  return false;
}

async function resolveCredentialIds(codes: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (codes.length === 0) return out;
  const rows = await db
    .select({ id: credentialTypes.id, code: credentialTypes.code })
    .from(credentialTypes)
    .where(inArray(credentialTypes.code, codes));
  for (const r of rows) out.set(r.code, r.id);
  return out;
}

export type SeedJobOutcome = "inserted" | "skipped" | "error";

export type SeedJobError = {
  source: SeedSource;
  url: string;
  error: string;
};

export async function seedJob(
  job: NormalizedJob,
): Promise<{ outcome: SeedJobOutcome; error?: SeedJobError; jobId?: number }> {
  try {
    // Primary dedup: exact source_hash match.
    const [existing] = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(eq(jobs.sourceHash, job.source_hash))
      .limit(1);
    if (existing) return { outcome: "skipped" };

    // Secondary (AI) dedup — narrow gate: same company + location in 30d.
    if (await isAISemanticDuplicate(job)) {
      console.log(`[seeder] AI dedup hit for "${job.title}" at ${job.company_name}`);
      return { outcome: "skipped" };
    }

    const employerId = await getOrCreateSeedEmployerUserId();
    const { city, state } = splitLocation(job.location_text);

    // Build a minimal "requirements" plain-text summary so the existing
    // jobs.requirements NOT NULL column has a sensible value. Actual
    // requirement matching uses job_credential_requirements (below).
    const requirementsText = [
      job.required_credential_codes.length
        ? `Required: ${job.required_credential_codes.join(", ")}`
        : null,
      job.preferred_credential_codes.length
        ? `Preferred: ${job.preferred_credential_codes.join(", ")}`
        : null,
      job.min_experience_years > 0 ? `${job.min_experience_years}+ years experience` : null,
    ]
      .filter(Boolean)
      .join("\n") || "See description.";

    const [inserted] = await db
      .insert(jobs)
      .values({
        employerId,
        title: job.title,
        companyName: job.company_name,
        description: job.description,
        requirements: requirementsText,
        jobType: job.job_type,
        employmentType: job.job_type,
        locationCity: city,
        locationState: state,
        locationCountry: "US",
        isRemote: job.is_remote,
        isPublished: true,
        publishedAt: new Date(),
        status: "active",
        isSeeded: true,
        sourceUrl: job.source_url,
        sourceName: job.source,
        sourceHash: job.source_hash,
        // Original posting date from the source. UI prefers this over
        // publishedAt/createdAt for "Posted X ago" so freshly-seeded jobs
        // don't all read as "just posted" when they were actually weeks old.
        externalPostedAt: job.posted_at,
        lat: job.lat !== null ? job.lat.toString() : null,
        lng: job.lng !== null ? job.lng.toString() : null,
        // Seeded jobs route applications back to the original ATS — the
        // employer isn't on LaneLogics yet, so an internal application would
        // land in a black hole at the system seed-agent user. Setting
        // applyUrl + isExternalApply makes the Apply button open the source
        // posting in a new tab. When/if the employer claims the listing,
        // they can flip these back to internal-apply.
        applyUrl: job.source_url,
        isExternalApply: true,
      } as any)
      .returning({ id: jobs.id });

    const jobId = inserted.id;

    // Resolve and persist credential requirements in one batch.
    const allCodes = [
      ...new Set([...job.required_credential_codes, ...job.preferred_credential_codes]),
    ];
    const codeMap = await resolveCredentialIds(allCodes);
    const reqRows: Array<{
      jobId: number;
      credentialTypeId: number;
      requirementLevel: "required" | "preferred";
    }> = [];
    for (const code of job.required_credential_codes) {
      const id = codeMap.get(code);
      if (id !== undefined) {
        reqRows.push({ jobId, credentialTypeId: id, requirementLevel: "required" });
      }
    }
    for (const code of job.preferred_credential_codes) {
      const id = codeMap.get(code);
      if (id !== undefined && !reqRows.some((r) => r.credentialTypeId === id)) {
        // Don't re-insert if Claude listed the same code as both required and
        // preferred — required takes precedence.
        reqRows.push({ jobId, credentialTypeId: id, requirementLevel: "preferred" });
      }
    }
    if (reqRows.length > 0) {
      await db.insert(jobCredentialRequirements).values(reqRows);
    }

    // Fire-and-forget — match recompute is best-effort and shouldn't gate
    // the seeder's throughput. Errors already log inside the helper.
    void recalculateMatchScoresForJob(jobId);

    return { outcome: "inserted", jobId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[seeder] failed to insert ${job.source_url}:`, err);
    return {
      outcome: "error",
      error: { source: job.source, url: job.source_url, error: message },
    };
  }
}

// Helper exported for the orchestrator: collect dedup-relevant counts in one
// place when it walks the most recent inserted rows.
export async function recentSeededJobIds(limit = 50): Promise<number[]> {
  const rows = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(eq(jobs.isSeeded, true))
    .orderBy(desc(jobs.createdAt))
    .limit(limit);
  return rows.map((r) => r.id);
}

export type { SeedErrorEntry };
