import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  setActiveSnapshot,
  setLastKnownGoodSnapshot,
  writeRegistrySnapshot,
} from "./snapshotStore";
import { logRegistryEvent } from "./eventLog";

type Severity = "SEV-1" | "SEV-2" | "SEV-3";

type DesignSystemRule = {
  ruleId: string;
  elementName: string;
  category: string;
  canonical: boolean;
  breakpoint?: string | null;
  visualValue?: string | null;
  activeLogic?: string | null;
  supersededBy?: string | null;
  referencesTokens?: string[]; // token Rule IDs (TOK-*)
};

type DesignSystemSecuritySnapshot = {
  registry: "design_system_security";
  generatedAt: string; // ISO timestamp
  rules: DesignSystemRule[];
};

type ValidationFailure = {
  validationRuleId: string; // stable ID
  severity: Severity;
  reason: string;
  ruleId?: string;
};

const REGISTRY_NAME = "design_system_security";

// Stable validation IDs (keep stable; do not rename)
const VAL = {
  INVALID_JSON: "VAL-DSSEC-INVALID_JSON",
  WRONG_REGISTRY: "VAL-DSSEC-WRONG_REGISTRY",
  MISSING_RULE_ID: "VAL-DSSEC-MISSING_RULE_ID",
  DUPLICATE_RULE_ID: "VAL-DSSEC-DUPLICATE_RULE_ID",
  NON_CANONICAL_MISSING_SUPERSEDED_BY: "VAL-DSSEC-NONCANONICAL_MISSING_SUPERSEDED_BY",
  MISSING_ELEMENT_NAME: "VAL-DSSEC-MISSING_ELEMENT_NAME",
  MISSING_CATEGORY: "VAL-DSSEC-MISSING_CATEGORY",
} as const;

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function normalizeForHash(snapshot: DesignSystemSecuritySnapshot) {
  // Ensure hash is stable even if ordering differs
  const rulesSorted = [...snapshot.rules].sort((a, b) => a.ruleId.localeCompare(b.ruleId));
  return {
    registry: snapshot.registry,
    // exclude generatedAt from hash so same content yields same hash
    rules: rulesSorted.map((r) => ({
      ruleId: r.ruleId,
      elementName: r.elementName,
      category: r.category,
      canonical: r.canonical,
      breakpoint: r.breakpoint ?? null,
      visualValue: r.visualValue ?? null,
      activeLogic: r.activeLogic ?? null,
      supersededBy: r.supersededBy ?? null,
      referencesTokens: r.referencesTokens ?? [],
    })),
  };
}

function validate(snapshot: DesignSystemSecuritySnapshot): ValidationFailure[] {
  const failures: ValidationFailure[] = [];

  if (snapshot.registry !== REGISTRY_NAME) {
    failures.push({
      validationRuleId: VAL.WRONG_REGISTRY,
      severity: "SEV-2",
      reason: `snapshot.registry must be "${REGISTRY_NAME}"`,
    });
    return failures;
  }

  const seen = new Set<string>();

  for (const rule of snapshot.rules) {
    if (!rule.ruleId || !rule.ruleId.trim()) {
      failures.push({
        validationRuleId: VAL.MISSING_RULE_ID,
        severity: "SEV-2",
        reason: "ruleId is required",
      });
      continue;
    }

    if (seen.has(rule.ruleId)) {
      failures.push({
        validationRuleId: VAL.DUPLICATE_RULE_ID,
        severity: "SEV-2",
        reason: `duplicate ruleId: ${rule.ruleId}`,
        ruleId: rule.ruleId,
      });
    } else {
      seen.add(rule.ruleId);
    }

    if (!rule.elementName || !rule.elementName.trim()) {
      failures.push({
        validationRuleId: VAL.MISSING_ELEMENT_NAME,
        severity: "SEV-3",
        reason: `elementName is required for ${rule.ruleId}`,
        ruleId: rule.ruleId,
      });
    }

    if (!rule.category || !rule.category.trim()) {
      failures.push({
        validationRuleId: VAL.MISSING_CATEGORY,
        severity: "SEV-3",
        reason: `category is required for ${rule.ruleId}`,
        ruleId: rule.ruleId,
      });
    }

    // Mirrors your Notion governance: non-canonical must be superseded
    if (rule.canonical === false) {
      if (!rule.supersededBy || !rule.supersededBy.trim()) {
        failures.push({
          validationRuleId: VAL.NON_CANONICAL_MISSING_SUPERSEDED_BY,
          severity: "SEV-2",
          reason: `non-canonical rule must set supersededBy (${rule.ruleId})`,
          ruleId: rule.ruleId,
        });
      }
    }
  }

  return failures;
}

async function loadFromLocalFile(): Promise<DesignSystemSecuritySnapshot> {
  const filePath = path.join(
    process.cwd(),
    "server",
    "registry",
    "sources",
    "designSystemSecurity.local.json",
  );

  const raw = await fs.readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw) as Omit<DesignSystemSecuritySnapshot, "generatedAt">;

  return {
    registry: REGISTRY_NAME,
    generatedAt: new Date().toISOString(),
    rules: parsed.rules ?? [],
  };
}

/**
 * Syncs Design System & Security registry into registry_snapshots.
 * - Writes a snapshot every run.
 * - Promotes to active + last-known-good only when validation passes.
 */
export async function syncDesignSystemSecurity(args: { environment: string }) {
  const environment = args.environment;

  let snapshot: DesignSystemSecuritySnapshot;
  try {
    snapshot = await loadFromLocalFile();
  } catch (err: any) {
    await logRegistryEvent({
      environment,
      registryName: REGISTRY_NAME,
      eventType: "registry.sync_failed",
      severity: "SEV-2",
      validationRuleId: VAL.INVALID_JSON,
      reason: `Failed to load local registry JSON: ${err?.message ?? String(err)}`,
      details: {},
    });
    throw err;
  }

  const normalized = normalizeForHash(snapshot);
  const contentHash = sha256(JSON.stringify(normalized));

  const failures = validate(snapshot);

  // Write snapshot regardless (for debugging/history)
  const snapRow = await writeRegistrySnapshot({
    environment,
    registryName: REGISTRY_NAME,
    contentHash,
    payload: snapshot,
    rowUrls: [], // not available from local file yet
    validRowCount: Math.max(0, snapshot.rules.length - failures.length),
    invalidRowCount: failures.length,
  });

  if (failures.length === 0) {
    await setLastKnownGoodSnapshot({
      snapshotId: snapRow.id,
      environment,
      registryName: REGISTRY_NAME,
    });
    await setActiveSnapshot({
      snapshotId: snapRow.id,
      environment,
      registryName: REGISTRY_NAME,
    });

    await logRegistryEvent({
      environment,
      registryName: REGISTRY_NAME,
      eventType: "registry.sync_success",
      severity: "SEV-3",
      activeSnapshotId: snapRow.id,
      lastKnownGoodSnapshotId: snapRow.id,
      details: {
        contentHash,
        ruleCount: snapshot.rules.length,
      },
    });

    return { ok: true, snapshotId: snapRow.id, promoted: true };
  }

  // If invalid, do not promote; log top failures
  const top = failures.slice(0, 5);

  await logRegistryEvent({
    environment,
    registryName: REGISTRY_NAME,
    eventType: "registry.validation_failed",
    severity: "SEV-2",
    activeSnapshotId: snapRow.id,
    lastKnownGoodSnapshotId: null,
    validationRuleId: top[0]?.validationRuleId,
    reason: top.map((f) => f.reason).join(" | "),
    details: {
      contentHash,
      failureCount: failures.length,
      topFailures: top,
    },
  });

  return { ok: false, snapshotId: snapRow.id, promoted: false, failures };
}