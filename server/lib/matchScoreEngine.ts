// Sprint 5 — pure scoring engine. NO database imports, NO side effects.
// Reusable for live scoring and projected-score ("what if I added X cred?")
// calculations. Tested in isolation via fixture inputs.

import type { ScoreBreakdown } from "@shared/matchTypes";
import type { RequirementLevel } from "@shared/schema";

export type EngineRequirement = {
  credential_type_id: number;
  code: string;
  requirement_level: RequirementLevel;
};

export type EngineLocation = { lat: number; lng: number } | null;

export type EngineInput = {
  seekerCredentials: string[];
  seekerYears: number | null;
  seekerLocation: EngineLocation;
  jobRequirements: EngineRequirement[];
  jobMinYears: number | null;
  jobLocation: EngineLocation;
  jobIsRemote: boolean;
};

export type EngineResult = {
  breakdown: ScoreBreakdown;
  score: number;
  projected_score: number;
  has_disqualifier: boolean;
};

// ─── Category scorers ────────────────────────────────────────────────────────

function scoreRequired(
  seekerCreds: Set<string>,
  reqs: EngineRequirement[],
): ScoreBreakdown["credentials_required"] {
  const required = reqs.filter((r) => r.requirement_level === "required");
  const met: string[] = [];
  const missing: string[] = [];
  for (const r of required) {
    if (seekerCreds.has(r.code)) met.push(r.code);
    else missing.push(r.code);
  }
  // No required credentials → trivially fully met.
  const score = required.length === 0
    ? 55
    : Math.round((met.length / required.length) * 55);
  return { score, max: 55, met, missing };
}

function scorePreferred(
  seekerCreds: Set<string>,
  reqs: EngineRequirement[],
): ScoreBreakdown["credentials_preferred"] {
  const preferred = reqs.filter((r) => r.requirement_level === "preferred");
  const met: string[] = [];
  const missing: string[] = [];
  for (const r of preferred) {
    if (seekerCreds.has(r.code)) met.push(r.code);
    else missing.push(r.code);
  }
  const score = preferred.length === 0
    ? 20
    : Math.round((met.length / preferred.length) * 20);
  return { score, max: 20, met, missing };
}

function scoreExperience(
  seekerYears: number | null,
  jobMinYears: number | null,
): ScoreBreakdown["experience"] {
  const sy = seekerYears ?? 0;
  const ry = jobMinYears ?? 0;
  let pts = 0;
  if (ry === 0) pts = 15; // job has no min — any seeker qualifies
  else if (sy >= ry) pts = 15;
  else if (sy >= ry * 0.75) pts = 8;
  else pts = 0;
  return { score: pts, max: 15, seeker_years: sy, required_years: ry };
}

// Haversine distance in miles between two lat/lng points.
function distanceMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8; // earth radius, miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function scoreLocation(
  seekerLoc: EngineLocation,
  jobLoc: EngineLocation,
  jobIsRemote: boolean,
): ScoreBreakdown["location"] {
  if (jobIsRemote) {
    return { score: 10, max: 10, distance_miles: null, remote: true };
  }
  if (!seekerLoc || !jobLoc) {
    return { score: 0, max: 10, distance_miles: null, remote: false };
  }
  const miles = Math.round(distanceMiles(seekerLoc, jobLoc));
  let pts = 0;
  if (miles <= 25) pts = 10;
  else if (miles <= 50) pts = 7;
  else if (miles <= 100) pts = 4;
  return { score: pts, max: 10, distance_miles: miles, remote: false };
}

// ─── Main entry point ────────────────────────────────────────────────────────

export function computeMatchScore(input: EngineInput): EngineResult {
  const seekerCredSet = new Set(input.seekerCredentials);

  const credentials_required = scoreRequired(seekerCredSet, input.jobRequirements);
  const credentials_preferred = scorePreferred(seekerCredSet, input.jobRequirements);
  const experience = scoreExperience(input.seekerYears, input.jobMinYears);
  const location = scoreLocation(input.seekerLocation, input.jobLocation, input.jobIsRemote);

  const breakdown: ScoreBreakdown = {
    credentials_required,
    credentials_preferred,
    experience,
    location,
  };

  const score =
    credentials_required.score +
    credentials_preferred.score +
    experience.score +
    location.score;

  // Projected = current + points unlocked by adding every missing credential.
  // Experience and location aren't gap-affected by credential additions.
  const projectedRequired = 55 - credentials_required.score;
  const projectedPreferred = 20 - credentials_preferred.score;
  const projected_score = Math.min(100, score + projectedRequired + projectedPreferred);

  const has_disqualifier = credentials_required.missing.length > 0;

  return { breakdown, score, projected_score, has_disqualifier };
}
