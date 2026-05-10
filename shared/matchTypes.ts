// Sprint 5: shared types for the seeker /matches dashboard. These are the
// API contract shapes — server returns them, client consumes them. Keep in
// sync with server/lib/matchScoreEngine.ts and server/routes/matches.ts.

import type { RequirementLevel } from "./schema";

export type ScoreTier = "strong" | "good" | "partial" | "low" | "disqualified";

export type ScoreBreakdown = {
  credentials_required: {
    score: number;
    max: 55;
    met: string[];
    missing: string[];
  };
  credentials_preferred: {
    score: number;
    max: 20;
    met: string[];
    missing: string[];
  };
  experience: {
    score: number;
    max: 15;
    seeker_years: number;
    required_years: number;
  };
  location: {
    score: number;
    max: 10;
    distance_miles: number | null;
    remote: boolean;
  };
};

export type CredentialGap = {
  credential_type_id: number;
  code: string;
  name: string;
  requirement_level: RequirementLevel;
  point_value: number;
  affected_job_count: number;
};

export type MatchJobSummary = {
  id: number;
  title: string;
  employer_name: string | null;
  location: string | null;
  job_type: string | null;
  modal_namespace: string | null;
};

export type MatchSummaryCounts = {
  required_met: number;
  required_total: number;
  preferred_met: number;
  preferred_total: number;
};

export type MatchScore = {
  job_id: number;
  score: number;
  projected_score: number;
  tier: ScoreTier;
  has_disqualifier: boolean;
  computed_at: string;
  job: MatchJobSummary;
  summary: MatchSummaryCounts;
};

export type MatchDetail = MatchScore & {
  score_breakdown: ScoreBreakdown;
  gaps: CredentialGap[];
  completion_prompt: string | null;
};

export type MatchListResponse = {
  matches: MatchScore[];
  page: number;
  limit: number;
  total: number;
  top_gap: CredentialGap | null;
};

// Score-tier thresholds. `disqualified` overrides the numeric tier when a
// required credential is missing — surface that ahead of the score bucket.
export function tierForScore(score: number, hasDisqualifier: boolean): ScoreTier {
  if (hasDisqualifier) return "disqualified";
  if (score >= 85) return "strong";
  if (score >= 65) return "good";
  if (score >= 45) return "partial";
  return "low";
}
