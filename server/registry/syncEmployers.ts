import crypto from "node:crypto";
import {
  fetchEmployers,
  fetchEmployerEvidence,
  type EmployerRow,
  type EmployerEvidenceRow,
  type EmployersSnapshot,
  type EmployerEvidenceSnapshot,
} from "./notionSync";
import {
  writeRegistrySnapshot,
  setActiveSnapshot,
  setLastKnownGoodSnapshot,
  type Environment,
} from "./snapshotStore";
import { logRegistryEvent, type Severity } from "./eventLog";
import { maybeSendSevEmail } from "../alerts/maybeSendSevEmail";

type ValidationError = {
  ruleId: string;
  rowUrl?: string;
  reason: string;
  severity: Severity;
};

function hashPayload(payload: unknown): string {
  const normalized = JSON.stringify(payload, Object.keys(payload as any).sort());
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

function validateEmployers(rows: EmployerRow[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const seenPageIds = new Set<string>();
  const seenDomains = new Set<string>();

  for (const row of rows) {
    if (seenPageIds.has(row.notionPageId)) {
      errors.push({
        ruleId: "VAL-EMP-DUPLICATE_PAGE_ID",
        rowUrl: row.notionPageId,
        reason: `Duplicate notionPageId: ${row.notionPageId}`,
        severity: "SEV-1",
      });
    }
    seenPageIds.add(row.notionPageId);

    if (!row.employer) {
      errors.push({
        ruleId: "VAL-EMP-EMPTY_NAME",
        rowUrl: row.notionPageId,
        reason: `Employer row has empty name`,
        severity: "SEV-2",
      });
    }

    if (row.domain) {
      const domainKey = row.domain.toLowerCase();
      if (seenDomains.has(domainKey)) {
        errors.push({
          ruleId: "VAL-EMP-DUPLICATE_DOMAIN",
          rowUrl: row.notionPageId,
          reason: `Duplicate domain: ${row.domain} on "${row.employer}"`,
          severity: "SEV-2",
        });
      }
      seenDomains.add(domainKey);
    }
  }

  return errors;
}

function validateEmployerEvidence(
  rows: EmployerEvidenceRow[],
  employerPageIds: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];
  const seenPageIds = new Set<string>();

  for (const row of rows) {
    if (seenPageIds.has(row.notionPageId)) {
      errors.push({
        ruleId: "VAL-EVD-DUPLICATE_PAGE_ID",
        rowUrl: row.notionPageId,
        reason: `Duplicate notionPageId: ${row.notionPageId}`,
        severity: "SEV-1",
      });
    }
    seenPageIds.add(row.notionPageId);

    for (const empId of row.employerPageIds) {
      if (!employerPageIds.has(empId)) {
        errors.push({
          ruleId: "VAL-EVD-INVALID_EMPLOYER_REF",
          rowUrl: row.notionPageId,
          reason: `Evidence "${row.evidence}" references unknown employer: ${empId}`,
          severity: "SEV-2",
        });
      }
    }
  }

  return errors;
}

export async function syncEmployers(opts: { environment: Environment }) {
  const { environment } = opts;
  const startedAt = Date.now();
  console.log(`[employer-sync] Starting sync (env=${environment})...`);

  const employersDbId = process.env.NOTION_EMPLOYERS_DB_ID;
  const evidenceDbId = process.env.NOTION_EVIDENCE_DB_ID;

  if (!employersDbId || !evidenceDbId) {
    const missing = [
      !employersDbId && "NOTION_EMPLOYERS_DB_ID",
      !evidenceDbId && "NOTION_EVIDENCE_DB_ID",
    ]
      .filter(Boolean)
      .join(", ");
    const msg = `Missing required env vars: ${missing}`;
    console.warn(`[employer-sync] ${msg} — skipping employer sync`);
    return { ok: false, error: "missing_config", message: msg };
  }

  let empSnapshot: EmployersSnapshot;
  let evdSnapshot: EmployerEvidenceSnapshot;

  try {
    [empSnapshot, evdSnapshot] = await Promise.all([
      fetchEmployers(),
      fetchEmployerEvidence(),
    ]);
    console.log(
      `[employer-sync] Fetched: ${empSnapshot.rows.length} employers, ${evdSnapshot.rows.length} evidence records`
    );
  } catch (err: any) {
    console.error("[employer-sync] Notion fetch failed:", err.message);
    await logRegistryEvent({
      environment,
      registryName: "employers",
      eventType: "registry.fetch_failed",
      severity: "SEV-1",
      reason: err.message,
    });
    await maybeSendSevEmail({
      severity: "SEV-1",
      environment,
      registryName: "employers",
      eventType: "registry.fetch_failed",
      subject: `[SEV-1] Employer sync fetch failed (${environment})`,
      bodyText: `Notion fetch failed: ${err.message}`,
    });
    return { ok: false, error: "fetch_failed", message: err.message };
  }

  const allErrors: ValidationError[] = [];

  const empErrors = validateEmployers(empSnapshot.rows);
  allErrors.push(...empErrors);

  const employerPageIds = new Set(empSnapshot.rows.map((r) => r.notionPageId));
  const evdErrors = validateEmployerEvidence(evdSnapshot.rows, employerPageIds);
  allErrors.push(...evdErrors);

  const hasSev1 = allErrors.some((e) => e.severity === "SEV-1");

  for (const err of allErrors) {
    await logRegistryEvent({
      environment,
      registryName: "employers",
      eventType: "registry.validation_failed",
      severity: err.severity,
      validationRuleId: err.ruleId,
      rowUrl: err.rowUrl,
      reason: err.reason,
    });
  }

  const snapshots = [
    {
      name: "employers" as const,
      payload: empSnapshot,
      rows: empSnapshot.rows,
      errorCount: empErrors.length,
    },
    {
      name: "employer_evidence" as const,
      payload: evdSnapshot,
      rows: evdSnapshot.rows,
      errorCount: evdErrors.length,
    },
  ];

  const writtenIds: { name: string; id: number }[] = [];
  for (const snap of snapshots) {
    const hash = hashPayload(snap.payload);
    const row = await writeRegistrySnapshot({
      environment,
      registryName: snap.name,
      contentHash: hash,
      payload: snap.payload,
      rowUrls: snap.rows.map((r: any) => r.notionPageId),
      validRowCount: snap.rows.length - snap.errorCount,
      invalidRowCount: snap.errorCount,
    });
    writtenIds.push({ name: snap.name, id: row.id });
  }

  if (hasSev1) {
    const errorSummary = allErrors
      .map((e) => `[${e.severity}] ${e.ruleId}: ${e.reason}`)
      .join("\n");

    console.error(
      `[employer-sync] Validation FAILED — ${allErrors.length} error(s). Keeping last-known-good.`
    );

    await logRegistryEvent({
      environment,
      registryName: "employers",
      eventType: "registry.promotion_blocked",
      severity: "SEV-1",
      reason: `${allErrors.length} validation error(s) blocked promotion`,
      details: { errorCount: allErrors.length },
    });

    await maybeSendSevEmail({
      severity: "SEV-1",
      environment,
      registryName: "employers",
      eventType: "registry.promotion_blocked",
      subject: `[SEV-1] Employer sync promotion blocked (${environment})`,
      bodyText: `Validation failed with ${allErrors.length} error(s):\n\n${errorSummary}`,
    });

    return {
      ok: false,
      error: "validation_failed",
      errorCount: allErrors.length,
      errors: allErrors.map((e) => ({
        ruleId: e.ruleId,
        reason: e.reason,
        severity: e.severity,
      })),
    };
  }

  if (allErrors.length > 0) {
    console.warn(
      `[employer-sync] ${allErrors.length} warning(s) — promoting anyway (no SEV-1)`
    );
  }

  for (const w of writtenIds) {
    await setActiveSnapshot({ snapshotId: w.id, environment, registryName: w.name });
    await setLastKnownGoodSnapshot({ snapshotId: w.id, environment, registryName: w.name });
  }

  const elapsed = Date.now() - startedAt;
  console.log(`[employer-sync] Both registries promoted to active + LKG (${elapsed}ms)`);

  await logRegistryEvent({
    environment,
    registryName: "employers",
    eventType: "registry.sync_success",
    severity: "SEV-3",
    reason: `Synced in ${elapsed}ms`,
    details: {
      employers: empSnapshot.rows.length,
      evidence: evdSnapshot.rows.length,
    },
  });

  return {
    ok: true,
    elapsed,
    employers: empSnapshot.rows.length,
    evidence: evdSnapshot.rows.length,
  };
}
