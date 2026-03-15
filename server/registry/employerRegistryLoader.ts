import { getActiveRegistrySnapshot } from "./snapshotStore.ts";
import type { EmployersSnapshot, EmployerEvidenceSnapshot, EmployerEvidenceRow } from "./notionSync.ts";

const MARKDOWN_LINK_RE = /^\[(.+?)\]\((.+?)\)$/;

function plainText(s: string): string {
  if (!s) return s;
  const m = s.match(MARKDOWN_LINK_RE);
  return m ? m[1] : s;
}

function plainUrl(s: string): string {
  if (!s) return s;
  const m = s.match(MARKDOWN_LINK_RE);
  return m ? m[2] : s;
}

function normalizeDomain(s: string): string {
  const raw = plainText(s).trim();
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
