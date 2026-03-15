import { getActiveRegistrySnapshot } from "./snapshotStore.ts";
import type { EmployersSnapshot, EmployerEvidenceSnapshot, EmployerEvidenceRow } from "./notionSync.ts";

const FULL_MD_RE = /^\[(.+?)\]\((.+?)\)$/;
const EMBED_MD_RE = /\[(.+?)\]\((.+?)\)/;

function plainText(s: string): string {
  if (!s) return s;
  const t = s.trim();
  const mFull = t.match(FULL_MD_RE);
  if (mFull) return mFull[1];
  const mEmbed = t.match(EMBED_MD_RE);
  if (mEmbed) return mEmbed[1];
  return t;
}

function plainUrl(s: string): string {
  if (!s) return s;
  const t = s.trim();
  const mFull = t.match(FULL_MD_RE);
  if (mFull) return mFull[2];
  const mEmbed = t.match(EMBED_MD_RE);
  if (mEmbed) return mEmbed[2];
  return t;
}

function normalizeDomain(s: string): string {
  const raw = plainText(s);
  return raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

export type VerificationBasis = {
  acceptedEvidenceCount: number;
  acceptedSourceTypes: string[];
};

export type EmployerResult = {
  notionPageId: string;
  employer: string;
  domain: string;
  website: string;
  primarySource: string;
  secondarySource: string;
  status: string;
  isVerified: boolean;
  verificationBasis: VerificationBasis;
};

export type LoadResult =
  | {
      ok: true;
      environment: string;
      counts: { employers: number; evidence: number; verifiedEligible: number };
      employers: EmployerResult[];
    }
  | { ok: false; error: string; message: string };

export async function loadEmployerRegistry(environment: string): Promise<LoadResult> {
  const [empSnap, evdSnap] = await Promise.all([
    getActiveRegistrySnapshot(environment, "employers"),
    getActiveRegistrySnapshot(environment, "employer_evidence"),
  ]);

  if (!empSnap) {
    return {
      ok: false,
      error: "no_active_snapshot",
      message: `No active snapshot found for registry "employers" in environment "${environment}"`,
    };
  }

  if (!evdSnap) {
    return {
      ok: false,
      error: "no_active_snapshot",
      message: `No active snapshot found for registry "employer_evidence" in environment "${environment}"`,
    };
  }

  const empPayload = empSnap.payload as EmployersSnapshot;
  const evdPayload = evdSnap.payload as EmployerEvidenceSnapshot;

  const evidenceRows: EmployerEvidenceRow[] = evdPayload.rows ?? [];

  const results: EmployerResult[] = empPayload.rows.map((employer) => {
    const linked = evidenceRows.filter(
      (ev) =>
        Array.isArray(ev.employerPageIds) &&
        ev.employerPageIds.includes(employer.notionPageId)
    );

    const accepted = linked.filter(
      (ev) => ev.decision === "Accepted" && ev.sourceType
    );

    const acceptedEvidenceCount = accepted.length;
    const distinctSourceTypes = [...new Set(accepted.map((ev) => ev.sourceType))].sort();
    const acceptedSourceTypes = distinctSourceTypes;

    const isVerified =
      employer.status === "Verified" &&
      acceptedEvidenceCount >= 2 &&
      distinctSourceTypes.length >= 2;

    return {
      notionPageId: employer.notionPageId,
      employer: employer.employer,
      domain: normalizeDomain(employer.domain),
      website: plainUrl(employer.website),
      primarySource: plainUrl(employer.primarySource),
      secondarySource: plainUrl(employer.secondarySource),
      status: employer.status,
      isVerified,
      verificationBasis: {
        acceptedEvidenceCount,
        acceptedSourceTypes,
      },
    };
  });

  for (const r of results) {
    const isBad = (v: string) => v && (v.includes("](") || v.startsWith("["));
    if (isBad(r.domain) || isBad(r.website) || isBad(r.primarySource) || isBad(r.secondarySource)) {
      console.warn(`[employer-registry] Residual markdown detected for "${r.employer}", re-normalizing`);
      r.domain = normalizeDomain(r.domain);
      r.website = plainUrl(r.website);
      r.primarySource = plainUrl(r.primarySource);
      r.secondarySource = plainUrl(r.secondarySource);
    }
  }

  const verifiedEligible = results.filter((r) => r.isVerified).length;

  return {
    ok: true,
    environment,
    counts: {
      employers: empPayload.rows.length,
      evidence: evidenceRows.length,
      verifiedEligible,
    },
    employers: results,
  };
}
