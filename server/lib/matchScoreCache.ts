// Sprint 5 — DB-aware cache layer that wraps the pure matchScoreEngine.
// Reads seeker + job + credential data, runs the engine, upserts into
// match_scores. Also provides read paths used by the /api/matches endpoints.

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
  jobs,
  users,
  seekerCertProfiles,
  jobCertRequirements,
  jobCredentialRequirements,
  credentialTypes,
  matchScores,
} from "@shared/schema";
import type { CdlClass, CdlEndorsement } from "@shared/certEnums";
import type {
  CredentialGap,
  MatchScore,
  MatchDetail,
  ScoreBreakdown,
  MatchSummaryCounts,
} from "@shared/matchTypes";
import { tierForScore } from "@shared/matchTypes";
import { computeMatchScore, type EngineRequirement } from "./matchScoreEngine";
import { sendNewMatchEmail } from "./emailNotifications";

const STRONG_MATCH_THRESHOLD = 65;

// ─── Seeker credential derivation ────────────────────────────────────────────
// Translate the legacy seekerCertProfiles fields (cdlClass + boolean
// endorsement flags) into the modal-agnostic credential codes used by the new
// credential_types registry. Sprint 4 only seeded the trucking namespace, so
// this is the trucking mapping; future modals add their own derivation.

const ENDORSEMENT_TO_CODE: Record<CdlEndorsement, string | null> = {
  H: "END_HAZMAT",
  X: "END_HAZMAT", // X = H+N combined; endorsement-flag-wise, hazmat applies
  N: "END_TANKER",
  T: "END_DOUBLES",
  P: "END_PASSENGER",
  S: "END_SCHOOL_BUS",
};

function deriveSeekerCredentialCodes(profile: {
  cdlClass: CdlClass | null;
  cdlEndorsements: CdlEndorsement[];
  hasHazmat: boolean;
  hasTanker: boolean;
  hasDoubleTriple: boolean;
  hasPassenger: boolean;
  hasSchoolBus: boolean;
} | null): string[] {
  if (!profile) return [];
  const codes = new Set<string>();
  if (profile.cdlClass) codes.add(`CDL_CLASS_${profile.cdlClass}`);
  for (const e of profile.cdlEndorsements ?? []) {
    const code = ENDORSEMENT_TO_CODE[e];
    if (code) codes.add(code);
  }
  if (profile.hasHazmat) codes.add("END_HAZMAT");
  if (profile.hasTanker) codes.add("END_TANKER");
  if (profile.hasDoubleTriple) codes.add("END_DOUBLES");
  if (profile.hasPassenger) codes.add("END_PASSENGER");
  if (profile.hasSchoolBus) codes.add("END_SCHOOL_BUS");
  return Array.from(codes);
}

// ─── Loaders ─────────────────────────────────────────────────────────────────

async function loadSeekerProfile(seekerId: number) {
  const rows = await db
    .select()
    .from(seekerCertProfiles)
    .where(eq(seekerCertProfiles.userId, seekerId))
    .limit(1);
  return rows[0] ?? null;
}

async function loadActiveJobs() {
  return db
    .select({
      id: jobs.id,
      title: jobs.title,
      employerId: jobs.employerId,
      companyName: jobs.companyName,
      jobType: jobs.jobType,
      isRemote: jobs.isRemote,
      locationCity: jobs.locationCity,
      locationState: jobs.locationState,
    })
    .from(jobs)
    .where(and(eq(jobs.isPublished, true), eq(jobs.status, "active")));
}

async function loadJobRequirementsByJobIds(jobIds: number[]): Promise<
  Map<number, EngineRequirement[]>
> {
  const out = new Map<number, EngineRequirement[]>();
  if (jobIds.length === 0) return out;
  const rows = await db
    .select({
      jobId: jobCredentialRequirements.jobId,
      credentialTypeId: jobCredentialRequirements.credentialTypeId,
      requirementLevel: jobCredentialRequirements.requirementLevel,
      code: credentialTypes.code,
    })
    .from(jobCredentialRequirements)
    .innerJoin(credentialTypes, eq(jobCredentialRequirements.credentialTypeId, credentialTypes.id))
    .where(inArray(jobCredentialRequirements.jobId, jobIds));
  for (const r of rows) {
    if (!out.has(r.jobId)) out.set(r.jobId, []);
    out.get(r.jobId)!.push({
      credential_type_id: r.credentialTypeId,
      code: r.code,
      requirement_level: r.requirementLevel,
    });
  }
  return out;
}

async function loadJobMinYears(jobIds: number[]): Promise<Map<number, number | null>> {
  const out = new Map<number, number | null>();
  if (jobIds.length === 0) return out;
  const rows = await db
    .select({
      jobId: jobCertRequirements.jobId,
      minYears: jobCertRequirements.minYearsExperience,
    })
    .from(jobCertRequirements)
    .where(inArray(jobCertRequirements.jobId, jobIds));
  for (const r of rows) out.set(r.jobId, r.minYears);
  return out;
}

// ─── Match notification helpers ──────────────────────────────────────────────

type SeekerNotifyInfo = { email: string; firstName: string | null };

async function loadSeekerNotifyInfo(seekerId: number): Promise<SeekerNotifyInfo | null> {
  const rows = await db
    .select({ email: users.email, firstName: users.firstName })
    .from(users)
    .where(eq(users.id, seekerId))
    .limit(1);
  return rows[0] ?? null;
}

async function topMetCredentialName(breakdown: import("@shared/matchTypes").ScoreBreakdown): Promise<string | null> {
  const code = breakdown.credentials_required.met[0] ?? breakdown.credentials_preferred.met[0];
  if (!code) return null;
  const [row] = await db
    .select({ name: credentialTypes.name })
    .from(credentialTypes)
    .where(eq(credentialTypes.code, code))
    .limit(1);
  return row?.name ?? code;
}

async function notifyStrongMatchIfNeeded(
  seeker: SeekerNotifyInfo | null,
  seekerId: number,
  jobId: number,
  score: number,
  hasDisqualifier: boolean,
  breakdown: import("@shared/matchTypes").ScoreBreakdown,
  job: { title: string; employer_name: string | null; location: string | null },
): Promise<void> {
  if (hasDisqualifier) return;
  if (score < STRONG_MATCH_THRESHOLD) return;
  if (!seeker) return;
  try {
    const credName = await topMetCredentialName(breakdown);
    await sendNewMatchEmail({
      userId: seekerId,
      to: seeker.email,
      jobId,
      vars: {
        firstName: seeker.firstName,
        jobTitle: job.title,
        employerName: job.employer_name,
        jobLocation: job.location,
        score,
        topMetCredential: credName,
      },
    });
  } catch (err) {
    // Match emails are best-effort — never break the upsert path.
    console.error("[match-notify] failed:", err);
  }
}

// ─── Recompute & upsert ──────────────────────────────────────────────────────

export type RecomputeResult = { upserted: number; skipped: number };

export type RecomputeForSeekerOptions = {
  // When true, skip strong-match email notifications during this recompute.
  // Set on the post-onboarding initial compute so a brand-new seeker doesn't
  // get a burst of emails for jobs that already exist. Subsequent recomputes
  // (manual recompute button, profile updates) leave this false so newly
  // qualifying matches still notify.
  suppressNotifications?: boolean;
};

export async function recomputeForSeeker(
  seekerId: number,
  options: RecomputeForSeekerOptions = {},
): Promise<RecomputeResult> {
  const profile = await loadSeekerProfile(seekerId);
  const seekerCredentials = deriveSeekerCredentialCodes(profile as any);
  const seekerYears = profile?.yearsExperience ?? null;

  const jobRows = await loadActiveJobs();
  const jobIds = jobRows.map((j) => j.id);
  const reqsByJob = await loadJobRequirementsByJobIds(jobIds);
  const minYearsByJob = await loadJobMinYears(jobIds);

  // Resolve employer company names in one pass for notification copy.
  const employerNameById = await loadEmployerCompanyNames(jobRows.map((j) => j.employerId));

  // Lazy-fetch seeker notify info once when first strong match appears.
  let seekerInfo: SeekerNotifyInfo | null | "unloaded" = "unloaded";

  let upserted = 0;
  let skipped = 0;
  for (const job of jobRows) {
    const reqs = reqsByJob.get(job.id) ?? [];
    if (reqs.length === 0) {
      skipped++;
      continue;
    }
    const result = computeMatchScore({
      seekerCredentials,
      seekerYears,
      seekerLocation: null,
      jobRequirements: reqs,
      jobMinYears: minYearsByJob.get(job.id) ?? null,
      jobLocation: null,
      jobIsRemote: !!job.isRemote,
    });

    await db
      .insert(matchScores)
      .values({
        seekerId,
        jobId: job.id,
        score: result.score,
        projectedScore: result.projected_score,
        scoreBreakdown: result.breakdown as unknown as object,
        hasDisqualifier: result.has_disqualifier,
      })
      .onConflictDoUpdate({
        target: [matchScores.seekerId, matchScores.jobId],
        set: {
          score: result.score,
          projectedScore: result.projected_score,
          scoreBreakdown: result.breakdown as unknown as object,
          hasDisqualifier: result.has_disqualifier,
          computedAt: new Date(),
        },
      });
    upserted++;

    if (
      !options.suppressNotifications &&
      result.score >= STRONG_MATCH_THRESHOLD &&
      !result.has_disqualifier
    ) {
      if (seekerInfo === "unloaded") seekerInfo = await loadSeekerNotifyInfo(seekerId);
      await notifyStrongMatchIfNeeded(
        seekerInfo,
        seekerId,
        job.id,
        result.score,
        result.has_disqualifier,
        result.breakdown,
        {
          title: job.title,
          employer_name: employerNameById.get(job.employerId) ?? job.companyName ?? null,
          location: jobLocationLabel(job.locationCity, job.locationState, job.isRemote),
        },
      );
    }
  }
  return { upserted, skipped };
}

async function loadEmployerCompanyNames(employerIds: number[]): Promise<Map<number, string | null>> {
  const out = new Map<number, string | null>();
  if (employerIds.length === 0) return out;
  const rows = await db
    .select({ id: users.id, companyName: users.companyName })
    .from(users)
    .where(inArray(users.id, employerIds));
  for (const r of rows) out.set(r.id, r.companyName);
  return out;
}

export async function recomputeForJob(jobId: number): Promise<RecomputeResult> {
  // Recompute this job for every seeker that has a cert profile.
  // (Seekers without one will have 0 scores; we lazily skip them.)
  const seekerProfiles = await db
    .select({ userId: seekerCertProfiles.userId })
    .from(seekerCertProfiles);

  let upserted = 0;
  let skipped = 0;
  for (const { userId } of seekerProfiles) {
    const r = await recomputeOne(userId, jobId);
    if (r) upserted++;
    else skipped++;
  }
  return { upserted, skipped };
}

async function recomputeOne(seekerId: number, jobId: number) {
  const [job] = await db
    .select({
      id: jobs.id,
      isRemote: jobs.isRemote,
      isPublished: jobs.isPublished,
      status: jobs.status,
    })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);
  if (!job || !job.isPublished || job.status !== "active") return false;

  const reqs = (await loadJobRequirementsByJobIds([jobId])).get(jobId) ?? [];
  if (reqs.length === 0) return false;

  const profile = await loadSeekerProfile(seekerId);
  const seekerCredentials = deriveSeekerCredentialCodes(profile as any);
  const seekerYears = profile?.yearsExperience ?? null;
  const minYears = (await loadJobMinYears([jobId])).get(jobId) ?? null;

  const result = computeMatchScore({
    seekerCredentials,
    seekerYears,
    seekerLocation: null,
    jobRequirements: reqs,
    jobMinYears: minYears,
    jobLocation: null,
    jobIsRemote: !!job.isRemote,
  });

  await db
    .insert(matchScores)
    .values({
      seekerId,
      jobId,
      score: result.score,
      projectedScore: result.projected_score,
      scoreBreakdown: result.breakdown as unknown as object,
      hasDisqualifier: result.has_disqualifier,
    })
    .onConflictDoUpdate({
      target: [matchScores.seekerId, matchScores.jobId],
      set: {
        score: result.score,
        projectedScore: result.projected_score,
        scoreBreakdown: result.breakdown as unknown as object,
        hasDisqualifier: result.has_disqualifier,
        computedAt: new Date(),
      },
    });

  if (result.score >= STRONG_MATCH_THRESHOLD && !result.has_disqualifier) {
    const seekerInfo = await loadSeekerNotifyInfo(seekerId);
    const [jobFull] = await db
      .select({
        title: jobs.title,
        companyName: jobs.companyName,
        locationCity: jobs.locationCity,
        locationState: jobs.locationState,
        isRemote: jobs.isRemote,
        employerCompanyName: users.companyName,
      })
      .from(jobs)
      .leftJoin(users, eq(jobs.employerId, users.id))
      .where(eq(jobs.id, jobId))
      .limit(1);
    if (jobFull) {
      await notifyStrongMatchIfNeeded(
        seekerInfo,
        seekerId,
        jobId,
        result.score,
        result.has_disqualifier,
        result.breakdown,
        {
          title: jobFull.title,
          employer_name: jobFull.employerCompanyName ?? jobFull.companyName ?? null,
          location: jobLocationLabel(jobFull.locationCity, jobFull.locationState, jobFull.isRemote),
        },
      );
    }
  }
  return true;
}

// ─── Read paths ──────────────────────────────────────────────────────────────

export type ListMatchesOptions = {
  sort?: "score" | "experience" | "location";
  order?: "asc" | "desc";
  minScore?: number;
  hideDisqualified?: boolean;
  page?: number;
  limit?: number;
};

function buildSummary(breakdown: ScoreBreakdown): MatchSummaryCounts {
  return {
    required_met: breakdown.credentials_required.met.length,
    required_total:
      breakdown.credentials_required.met.length + breakdown.credentials_required.missing.length,
    preferred_met: breakdown.credentials_preferred.met.length,
    preferred_total:
      breakdown.credentials_preferred.met.length + breakdown.credentials_preferred.missing.length,
  };
}

function jobLocationLabel(city: string | null, state: string | null, isRemote: boolean | null) {
  if (isRemote) return "Remote";
  if (city && state) return `${city}, ${state}`;
  return state ?? city ?? null;
}

export async function listMatchesForSeeker(
  seekerId: number,
  opts: ListMatchesOptions,
): Promise<{ matches: MatchScore[]; total: number }> {
  const sort = opts.sort ?? "score";
  const order = opts.order ?? "desc";
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  const offset = (page - 1) * limit;

  const conditions = [eq(matchScores.seekerId, seekerId)];
  if (typeof opts.minScore === "number") {
    conditions.push(sql`${matchScores.score} >= ${opts.minScore}`);
  }
  if (opts.hideDisqualified) {
    conditions.push(eq(matchScores.hasDisqualifier, false));
  }

  // Order column by sort param. "experience" / "location" sort by the JSONB
  // breakdown's category score.
  const orderExpr = (() => {
    if (sort === "experience") return sql`(${matchScores.scoreBreakdown}->'experience'->>'score')::int`;
    if (sort === "location") return sql`(${matchScores.scoreBreakdown}->'location'->>'score')::int`;
    return matchScores.score;
  })();
  const orderFn = order === "asc" ? asc : desc;

  const rows = await db
    .select({
      jobId: matchScores.jobId,
      score: matchScores.score,
      projectedScore: matchScores.projectedScore,
      hasDisqualifier: matchScores.hasDisqualifier,
      computedAt: matchScores.computedAt,
      scoreBreakdown: matchScores.scoreBreakdown,
      job: {
        id: jobs.id,
        title: jobs.title,
        companyName: jobs.companyName,
        locationCity: jobs.locationCity,
        locationState: jobs.locationState,
        jobType: jobs.jobType,
        isRemote: jobs.isRemote,
        employerId: jobs.employerId,
      },
      employer: {
        companyName: users.companyName,
      },
    })
    .from(matchScores)
    .innerJoin(jobs, eq(matchScores.jobId, jobs.id))
    .leftJoin(users, eq(jobs.employerId, users.id))
    .where(and(...conditions))
    .orderBy(orderFn(orderExpr))
    .limit(limit)
    .offset(offset);

  const totalRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(matchScores)
    .where(and(...conditions));
  const total = totalRows[0]?.count ?? 0;

  const matches: MatchScore[] = rows.map((r) => {
    const breakdown = r.scoreBreakdown as ScoreBreakdown;
    return {
      job_id: r.jobId,
      score: r.score,
      projected_score: r.projectedScore,
      tier: tierForScore(r.score, r.hasDisqualifier),
      has_disqualifier: r.hasDisqualifier,
      computed_at: r.computedAt.toISOString(),
      job: {
        id: r.job.id,
        title: r.job.title,
        employer_name: r.employer?.companyName ?? r.job.companyName ?? null,
        location: jobLocationLabel(r.job.locationCity, r.job.locationState, r.job.isRemote),
        job_type: r.job.jobType,
        modal_namespace: null, // surfaced in detail view via credential_types
      },
      summary: buildSummary(breakdown),
    };
  });

  return { matches, total };
}

export async function getMatchDetail(seekerId: number, jobId: number): Promise<MatchDetail | null> {
  const rows = await db
    .select({
      jobId: matchScores.jobId,
      score: matchScores.score,
      projectedScore: matchScores.projectedScore,
      hasDisqualifier: matchScores.hasDisqualifier,
      computedAt: matchScores.computedAt,
      scoreBreakdown: matchScores.scoreBreakdown,
      job: {
        id: jobs.id,
        title: jobs.title,
        companyName: jobs.companyName,
        locationCity: jobs.locationCity,
        locationState: jobs.locationState,
        jobType: jobs.jobType,
        isRemote: jobs.isRemote,
        employerId: jobs.employerId,
      },
      employer: { companyName: users.companyName },
    })
    .from(matchScores)
    .innerJoin(jobs, eq(matchScores.jobId, jobs.id))
    .leftJoin(users, eq(jobs.employerId, users.id))
    .where(and(eq(matchScores.seekerId, seekerId), eq(matchScores.jobId, jobId)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const breakdown = row.scoreBreakdown as ScoreBreakdown;
  const gaps = await buildGapsForMatch(seekerId, breakdown);

  const tier = tierForScore(row.score, row.hasDisqualifier);
  const detail: MatchDetail = {
    job_id: row.jobId,
    score: row.score,
    projected_score: row.projectedScore,
    tier,
    has_disqualifier: row.hasDisqualifier,
    computed_at: row.computedAt.toISOString(),
    job: {
      id: row.job.id,
      title: row.job.title,
      employer_name: row.employer?.companyName ?? row.job.companyName ?? null,
      location: jobLocationLabel(row.job.locationCity, row.job.locationState, row.job.isRemote),
      job_type: row.job.jobType,
      modal_namespace: null,
    },
    summary: buildSummary(breakdown),
    score_breakdown: breakdown,
    gaps,
    completion_prompt: completionPromptFromGaps(gaps, row.score),
  };
  return detail;
}

// ─── Gap analysis ────────────────────────────────────────────────────────────

async function buildGapsForMatch(
  seekerId: number,
  breakdown: ScoreBreakdown,
): Promise<CredentialGap[]> {
  const missingCodes = [
    ...breakdown.credentials_required.missing.map((code) => ({ code, level: "required" as const })),
    ...breakdown.credentials_preferred.missing.map((code) => ({ code, level: "preferred" as const })),
  ];
  if (missingCodes.length === 0) return [];

  const codes = missingCodes.map((m) => m.code);
  const credRows = await db
    .select({ id: credentialTypes.id, code: credentialTypes.code, name: credentialTypes.name })
    .from(credentialTypes)
    .where(inArray(credentialTypes.code, codes));
  const credByCode = new Map(credRows.map((c) => [c.code, c]));

  // affected_job_count: of this seeker's matches, how many list this code as missing?
  const affected = await affectedJobCountByCode(seekerId, codes);

  return missingCodes
    .map<CredentialGap | null>((m) => {
      const cred = credByCode.get(m.code);
      if (!cred) return null;
      // Per-credential point value within a single job: spec says required=55,
      // preferred=20 are the category caps. The contribution per missing
      // credential is (cap / total_in_category). Here we report the whole
      // category cap as a rough upper bound — the breakdown panel shows the
      // accurate split.
      const point_value = m.level === "required" ? 55 : 20;
      return {
        credential_type_id: cred.id,
        code: cred.code,
        name: cred.name,
        requirement_level: m.level,
        point_value,
        affected_job_count: affected.get(m.code) ?? 1,
      };
    })
    .filter((g): g is CredentialGap => g !== null);
}

async function affectedJobCountByCode(
  seekerId: number,
  codes: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (codes.length === 0) return out;
  // For each code, count match_scores rows where missing[] contains it.
  // Done with a JSONB containment query per code. Small N expected.
  for (const code of codes) {
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(matchScores)
      .where(
        and(
          eq(matchScores.seekerId, seekerId),
          sql`(${matchScores.scoreBreakdown}->'credentials_required'->'missing') @> ${JSON.stringify([code])}::jsonb
              OR (${matchScores.scoreBreakdown}->'credentials_preferred'->'missing') @> ${JSON.stringify([code])}::jsonb`,
        ),
      );
    out.set(code, rows[0]?.count ?? 0);
  }
  return out;
}

function completionPromptFromGaps(gaps: CredentialGap[], _currentScore: number): string | null {
  if (gaps.length === 0) return null;
  // Pick the gap with the most affected jobs (and required > preferred as tiebreak).
  const top = [...gaps].sort((a, b) => {
    if (b.affected_job_count !== a.affected_job_count) {
      return b.affected_job_count - a.affected_job_count;
    }
    if (a.requirement_level !== b.requirement_level) {
      return a.requirement_level === "required" ? -1 : 1;
    }
    return 0;
  })[0];
  const noun = top.affected_job_count === 1 ? "match" : "matches";
  return `Add ${top.name} to improve ${top.affected_job_count} ${noun}`;
}

// ─── Page-level top gap (used on the matches list) ───────────────────────────

export async function topGapForSeeker(seekerId: number): Promise<CredentialGap | null> {
  // Aggregate: per credential code, count how many matches surface it as
  // missing. Return the highest-impact one.
  const rows = await db
    .select({
      breakdown: matchScores.scoreBreakdown,
    })
    .from(matchScores)
    .where(eq(matchScores.seekerId, seekerId));
  if (rows.length === 0) return null;

  const counts = new Map<string, { level: "required" | "preferred"; count: number }>();
  for (const r of rows) {
    const b = r.breakdown as ScoreBreakdown;
    for (const code of b.credentials_required.missing) {
      const cur = counts.get(code);
      counts.set(code, { level: "required", count: (cur?.count ?? 0) + 1 });
    }
    for (const code of b.credentials_preferred.missing) {
      const cur = counts.get(code);
      // Don't downgrade required → preferred if both surface it
      const level = cur?.level === "required" ? "required" : "preferred";
      counts.set(code, { level, count: (cur?.count ?? 0) + 1 });
    }
  }
  if (counts.size === 0) return null;

  const ranked = [...counts.entries()].sort((a, b) => {
    if (b[1].count !== a[1].count) return b[1].count - a[1].count;
    if (a[1].level !== b[1].level) return a[1].level === "required" ? -1 : 1;
    return 0;
  });
  const [topCode, topInfo] = ranked[0];
  const [cred] = await db
    .select({ id: credentialTypes.id, code: credentialTypes.code, name: credentialTypes.name })
    .from(credentialTypes)
    .where(eq(credentialTypes.code, topCode))
    .limit(1);
  if (!cred) return null;
  return {
    credential_type_id: cred.id,
    code: cred.code,
    name: cred.name,
    requirement_level: topInfo.level,
    point_value: topInfo.level === "required" ? 55 : 20,
    affected_job_count: topInfo.count,
  };
}
