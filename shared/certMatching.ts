import type { SeekerCertProfile } from "./schema";
import type { JobCertRequirements } from "./schema";

// ─── Result shape ─────────────────────────────────────────────────────────────

export type CertMatchResult = {
  /** true only when every hard requirement is satisfied */
  isMatch: boolean;
  /** 0–100 score; 100 = perfect match */
  score: number;
  /** Each requirement evaluated — drives UI badge/tooltip */
  breakdown: CertMatchBreakdown[];
};

export type CertMatchBreakdown = {
  requirement: string;
  passed: boolean;
  detail: string;
};

// ─── CDL class hierarchy ──────────────────────────────────────────────────────
// Class A satisfies A, B, or C requirements.
// Class B satisfies B or C requirements.
// Class C satisfies only C requirements.

const CLASS_RANK: Record<string, number> = { A: 3, B: 2, C: 1 };

function classCoversRequirement(
  seekerClass: string | null | undefined,
  requiredClass: string | null | undefined
): boolean {
  if (!requiredClass) return true;       // no class required
  if (!seekerClass) return false;        // required but seeker has none
  return (CLASS_RANK[seekerClass] ?? 0) >= (CLASS_RANK[requiredClass] ?? 0);
}

// ─── Core matcher ─────────────────────────────────────────────────────────────

export function matchCerts(
  seeker: SeekerCertProfile | null,
  job: JobCertRequirements | null
): CertMatchResult {
  // No job requirements — everyone matches, score 100
  if (!job || !job.cdlRequired) {
    return {
      isMatch: true,
      score: 100,
      breakdown: [
        { requirement: "CDL Required", passed: true, detail: "No CDL required for this position" },
      ],
    };
  }

  // Job requires CDL but seeker has no profile
  if (!seeker) {
    return {
      isMatch: false,
      score: 0,
      breakdown: [
        { requirement: "CDL Required", passed: false, detail: "No cert profile on file" },
      ],
    };
  }

  const breakdown: CertMatchBreakdown[] = [];

  // ── 1. CDL class ──────────────────────────────────────────────────────────
  const classRequired = job.cdlClassRequired;
  const classPassed = classCoversRequirement(seeker.cdlClass, classRequired);
  breakdown.push({
    requirement: "CDL Class",
    passed: classPassed,
    detail: classRequired
      ? classPassed
        ? `Class ${seeker.cdlClass} meets Class ${classRequired} requirement`
        : `Class ${seeker.cdlClass ?? "none"} does not meet Class ${classRequired} requirement`
      : "No class requirement",
  });

  // ── 2. Endorsements ───────────────────────────────────────────────────────
  const requiredEndorsements = job.cdlEndorsementsRequired ?? [];
  const seekerEndorsements = seeker.cdlEndorsements ?? [];

  for (const code of requiredEndorsements) {
    // X endorsement (HazMat + Tanker combo) can be satisfied by X itself or both H and N
    let passed: boolean;
    if (code === "X") {
      passed =
        seekerEndorsements.includes("X") ||
        (seekerEndorsements.includes("H") && seekerEndorsements.includes("N"));
    } else {
      passed = seekerEndorsements.includes(code) || seekerEndorsements.includes("X");
    }

    breakdown.push({
      requirement: `Endorsement: ${code}`,
      passed,
      detail: passed
        ? `Seeker holds required endorsement ${code}`
        : `Missing endorsement ${code}`,
    });
  }

  // ── 3. Experience ─────────────────────────────────────────────────────────
  const minYears = job.minYearsExperience;
  if (minYears != null && minYears > 0) {
    const seekerYears = seeker.yearsExperience ?? 0;
    const expPassed = seekerYears >= minYears;
    breakdown.push({
      requirement: "Years of Experience",
      passed: expPassed,
      detail: expPassed
        ? `${seekerYears} year(s) meets ${minYears}-year minimum`
        : `${seekerYears} year(s) below ${minYears}-year minimum`,
    });
  }

  // ── 4. CDL expiry ─────────────────────────────────────────────────────────
  if (seeker.cdlExpiresAt) {
    const expired = new Date(seeker.cdlExpiresAt) < new Date();
    breakdown.push({
      requirement: "CDL Expiry",
      passed: !expired,
      detail: expired
        ? `CDL expired on ${new Date(seeker.cdlExpiresAt).toLocaleDateString()}`
        : `CDL valid through ${new Date(seeker.cdlExpiresAt).toLocaleDateString()}`,
    });
  }

  // ── Score + hard-pass decision ────────────────────────────────────────────
  const total = breakdown.length;
  const passed = breakdown.filter((b) => b.passed).length;
  const score = total === 0 ? 100 : Math.round((passed / total) * 100);
  const isMatch = breakdown.every((b) => b.passed);

  return { isMatch, score, breakdown };
}