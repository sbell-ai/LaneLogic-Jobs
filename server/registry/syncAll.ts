import crypto from "node:crypto";
import {
  fetchProductsPricing,
  fetchFeaturesEntitlements,
  fetchProductEntitlementOverrides,
  fetchComplianceRules,
  type ProductsPricingSnapshot,
  type FeaturesEntitlementsSnapshot,
  type ProductEntitlementOverridesSnapshot,
  type ComplianceRulesSnapshot,
  type ProductRow,
  type EntitlementRow,
  type OverrideRow,
  type ComplianceRuleRow,
} from "./notionSync";
import {
  writeRegistrySnapshot,
  setActiveSnapshot,
  setLastKnownGoodSnapshot,
  getActiveRegistrySnapshot,
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

const REGISTRY_NAMES = [
  "products_pricing",
  "features_entitlements",
  "product_entitlement_overrides",
  "compliance_rules",
] as const;

function hashPayload(payload: unknown): string {
  const normalized = JSON.stringify(payload, Object.keys(payload as any).sort());
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

function isSellable(p: ProductRow): boolean {
  return (
    p.status === "Active" &&
    (p.planType === "Subscription" || p.planType === "Top-up") &&
    !!p.stripePriceId
  );
}

function isFreeTier(p: ProductRow): boolean {
  return (
    p.status === "Active" &&
    p.planType === "Subscription" &&
    p.price === 0 &&
    !p.stripePriceId
  );
}

function isOverrideRequired(p: ProductRow): boolean {
  return isSellable(p) || isFreeTier(p);
}

function validateProductsPricing(rows: ProductRow[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const seenPageIds = new Set<string>();
  const seenPriceIds = new Set<string>();

  for (const row of rows) {
    if (seenPageIds.has(row.notionPageId)) {
      errors.push({
        ruleId: "VAL-PROD-DUPLICATE_PAGE_ID",
        rowUrl: row.notionPageId,
        reason: `Duplicate notionPageId: ${row.notionPageId}`,
        severity: "SEV-1",
      });
    }
    seenPageIds.add(row.notionPageId);

    if (row.status !== "Active") continue;

    if (row.price < 0) {
      errors.push({
        ruleId: "VAL-PROD-NEGATIVE_PRICE",
        rowUrl: row.notionPageId,
        reason: `Product "${row.productName}" has negative price: ${row.price}`,
        severity: "SEV-1",
      });
    }

    const validPlanTypes = ["Subscription", "Top-up", "Admin/Flag"];
    if (row.planType && !validPlanTypes.includes(row.planType)) {
      errors.push({
        ruleId: "VAL-PROD-INVALID_PLAN_TYPE",
        rowUrl: row.notionPageId,
        reason: `Product "${row.productName}" has invalid planType: "${row.planType}"`,
        severity: "SEV-2",
      });
    }

    const validCycles = ["Monthly", "Yearly", "One-time", ""];
    if (row.planType !== "Admin/Flag" && !validCycles.includes(row.billingCycle)) {
      errors.push({
        ruleId: "VAL-PROD-INVALID_BILLING_CYCLE",
        rowUrl: row.notionPageId,
        reason: `Product "${row.productName}" has invalid billingCycle: "${row.billingCycle}"`,
        severity: "SEV-2",
      });
    }

    if (row.planType === "Admin/Flag") {
      if (row.stripeProductId || row.stripePriceId) {
        errors.push({
          ruleId: "VAL-PROD-ADMIN_HAS_STRIPE",
          rowUrl: row.notionPageId,
          reason: `Admin/Flag product "${row.productName}" must not have Stripe IDs`,
          severity: "SEV-1",
        });
      }
    } else if (
      row.planType === "Subscription" || row.planType === "Top-up"
    ) {
      if (row.stripePriceId) {
        if (!row.stripeProductId) {
          errors.push({
            ruleId: "VAL-PROD-MISSING_STRIPE_PRODUCT_ID",
            rowUrl: row.notionPageId,
            reason: `Product "${row.productName}" has stripePriceId but no stripeProductId`,
            severity: "SEV-1",
          });
        }
        if (seenPriceIds.has(row.stripePriceId)) {
          errors.push({
            ruleId: "VAL-PROD-DUPLICATE_PRICE_ID",
            rowUrl: row.notionPageId,
            reason: `Duplicate stripePriceId: ${row.stripePriceId} on "${row.productName}"`,
            severity: "SEV-1",
          });
        }
        seenPriceIds.add(row.stripePriceId);
      }
    }
  }

  return errors;
}

function validateFeaturesEntitlements(rows: EntitlementRow[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const seenPageIds = new Set<string>();
  const seenKeys = new Set<string>();

  for (const row of rows) {
    if (seenPageIds.has(row.notionPageId)) {
      errors.push({
        ruleId: "VAL-ENT-DUPLICATE_PAGE_ID",
        rowUrl: row.notionPageId,
        reason: `Duplicate notionPageId: ${row.notionPageId}`,
        severity: "SEV-1",
      });
    }
    seenPageIds.add(row.notionPageId);

    if (!row.entitlementKey) {
      errors.push({
        ruleId: "VAL-ENT-EMPTY_KEY",
        rowUrl: row.notionPageId,
        reason: `Entitlement "${row.entitlementName}" has empty entitlementKey`,
        severity: "SEV-1",
      });
    } else if (seenKeys.has(row.entitlementKey)) {
      errors.push({
        ruleId: "VAL-ENT-DUPLICATE_KEY",
        rowUrl: row.notionPageId,
        reason: `Duplicate entitlementKey: ${row.entitlementKey}`,
        severity: "SEV-1",
      });
    }
    seenKeys.add(row.entitlementKey);

    if (row.type !== "Limit" && row.type !== "Flag") {
      errors.push({
        ruleId: "VAL-ENT-INVALID_TYPE",
        rowUrl: row.notionPageId,
        reason: `Entitlement "${row.entitlementName}" has invalid type: "${row.type}" (expected Limit or Flag)`,
        severity: "SEV-1",
      });
    }
  }

  return errors;
}

function validateOverrides(
  rows: OverrideRow[],
  productPageIds: Set<string>,
  entitlementMap: Map<string, EntitlementRow>
): ValidationError[] {
  const errors: ValidationError[] = [];
  const seenPageIds = new Set<string>();
  const activePairCounts = new Map<string, number>();

  for (const row of rows) {
    if (seenPageIds.has(row.notionPageId)) {
      errors.push({
        ruleId: "VAL-OVR-DUPLICATE_PAGE_ID",
        rowUrl: row.notionPageId,
        reason: `Duplicate notionPageId: ${row.notionPageId}`,
        severity: "SEV-1",
      });
    }
    seenPageIds.add(row.notionPageId);

    if (!row.productPageId || !productPageIds.has(row.productPageId)) {
      errors.push({
        ruleId: "VAL-OVR-INVALID_PRODUCT_REF",
        rowUrl: row.notionPageId,
        reason: `Override "${row.overrideName}" references invalid product: ${row.productPageId}`,
        severity: "SEV-2",
      });
    }

    const entitlement = entitlementMap.get(row.entitlementPageId);
    if (!row.entitlementPageId || !entitlement) {
      errors.push({
        ruleId: "VAL-OVR-INVALID_ENTITLEMENT_REF",
        rowUrl: row.notionPageId,
        reason: `Override "${row.overrideName}" references invalid entitlement: ${row.entitlementPageId}`,
        severity: "SEV-2",
      });
    }

    if (row.status === "Active") {
      const pairKey = `${row.productPageId}::${row.entitlementPageId}`;
      activePairCounts.set(pairKey, (activePairCounts.get(pairKey) || 0) + 1);

      if (entitlement) {
        if (entitlement.type === "Limit") {
          if (
            !row.isUnlimited &&
            (row.value === null || row.value === undefined || row.value < 0)
          ) {
            errors.push({
              ruleId: "VAL-OVR-LIMIT_MISSING_VALUE",
              rowUrl: row.notionPageId,
              reason: `Override "${row.overrideName}" for Limit entitlement must have value ≥ 0 or isUnlimited=true`,
              severity: "SEV-2",
            });
          }
        }
      }
    }
  }

  for (const [pairKey, count] of activePairCounts) {
    if (count > 1) {
      errors.push({
        ruleId: "VAL-OVR-DUPLICATE_ACTIVE_PAIR",
        rowUrl: pairKey,
        reason: `Multiple Active overrides (${count}) for product+entitlement pair: ${pairKey} — last override wins at runtime`,
        severity: "SEV-2",
      });
    }
  }

  return errors;
}

function validateComplianceRules(rows: ComplianceRuleRow[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const seenPageIds = new Set<string>();

  for (const row of rows) {
    if (seenPageIds.has(row.notionPageId)) {
      errors.push({
        ruleId: "VAL-COMP-DUPLICATE_PAGE_ID",
        rowUrl: row.notionPageId,
        reason: `Duplicate notionPageId: ${row.notionPageId}`,
        severity: "SEV-2",
      });
    }
    seenPageIds.add(row.notionPageId);

    if (!row.ruleName) {
      errors.push({
        ruleId: "VAL-COMP-EMPTY_RULE_NAME",
        rowUrl: row.notionPageId,
        reason: `Compliance rule has empty ruleName`,
        severity: "SEV-2",
      });
    }
    if (!row.category) {
      errors.push({
        ruleId: "VAL-COMP-EMPTY_CATEGORY",
        rowUrl: row.notionPageId,
        reason: `Compliance rule "${row.ruleName}" has empty category`,
        severity: "SEV-2",
      });
    }
  }

  return errors;
}

function crossRegistryValidation(
  products: ProductRow[],
  overrides: OverrideRow[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  const activeOverrideSet = new Set<string>();
  for (const o of overrides) {
    if (o.status === "Active") {
      activeOverrideSet.add(`${o.productPageId}::${o.entitlementPageId}`);
    }
  }

  const overrideRequiredProducts = products.filter(isOverrideRequired);

  for (const product of overrideRequiredProducts) {
    for (const entPageId of product.entitlementPageIds) {
      const key = `${product.notionPageId}::${entPageId}`;
      if (!activeOverrideSet.has(key)) {
        const isTopUp = product.planType === "Top-up";
        errors.push({
          ruleId: "VAL-XREG-MISSING_OVERRIDE",
          rowUrl: product.notionPageId,
          reason: `Product "${product.productName}" includes entitlement ${entPageId} but has no Active override${isTopUp ? " (Top-up — implicit enable at runtime)" : ""}`,
          severity: isTopUp ? "SEV-2" : "SEV-1",
        });
      }
    }
  }

  return errors;
}

export async function syncAllRegistries(opts: { environment: Environment }) {
  const { environment } = opts;
  const startedAt = Date.now();
  console.log(`[registry-sync] Starting atomic sync run (env=${environment})...`);

  let ppSnapshot: ProductsPricingSnapshot;
  let feSnapshot: FeaturesEntitlementsSnapshot;
  let ovrSnapshot: ProductEntitlementOverridesSnapshot;
  let compSnapshot: ComplianceRulesSnapshot;

  try {
    [ppSnapshot, feSnapshot, ovrSnapshot, compSnapshot] = await Promise.all([
      fetchProductsPricing(),
      fetchFeaturesEntitlements(),
      fetchProductEntitlementOverrides(),
      fetchComplianceRules(),
    ]);
    console.log(
      `[registry-sync] Fetched: ${ppSnapshot.rows.length} products, ${feSnapshot.rows.length} entitlements, ${ovrSnapshot.rows.length} overrides, ${compSnapshot.rows.length} compliance rules`
    );
  } catch (err: any) {
    console.error("[registry-sync] Notion fetch failed:", err.message);
    await logRegistryEvent({
      environment,
      registryName: "all",
      eventType: "registry.fetch_failed",
      severity: "SEV-1",
      reason: err.message,
    });
    await maybeSendSevEmail({
      severity: "SEV-1",
      environment,
      registryName: "all",
      eventType: "registry.fetch_failed",
      subject: `[SEV-1] Registry fetch failed (${environment})`,
      bodyText: `Notion fetch failed: ${err.message}`,
    });
    return { ok: false, error: "fetch_failed", message: err.message };
  }

  const allErrors: ValidationError[] = [];

  const ppErrors = validateProductsPricing(ppSnapshot.rows);
  allErrors.push(...ppErrors);

  const feErrors = validateFeaturesEntitlements(feSnapshot.rows);
  allErrors.push(...feErrors);

  const productPageIds = new Set(ppSnapshot.rows.map((r) => r.notionPageId));
  const entitlementMap = new Map(
    feSnapshot.rows.map((r) => [r.notionPageId, r])
  );
  const ovrErrors = validateOverrides(ovrSnapshot.rows, productPageIds, entitlementMap);
  allErrors.push(...ovrErrors);

  const compErrors = validateComplianceRules(compSnapshot.rows);
  allErrors.push(...compErrors);

  const xregErrors = crossRegistryValidation(ppSnapshot.rows, ovrSnapshot.rows);
  allErrors.push(...xregErrors);

  const hasSev1 = allErrors.some((e) => e.severity === "SEV-1");

  for (const err of allErrors) {
    await logRegistryEvent({
      environment,
      registryName: "all",
      eventType: "registry.validation_failed",
      severity: err.severity,
      validationRuleId: err.ruleId,
      rowUrl: err.rowUrl,
      reason: err.reason,
    });
  }

  const snapshots = [
    {
      name: "products_pricing" as const,
      payload: ppSnapshot,
      rows: ppSnapshot.rows,
      errorCount: ppErrors.length,
    },
    {
      name: "features_entitlements" as const,
      payload: feSnapshot,
      rows: feSnapshot.rows,
      errorCount: feErrors.length,
    },
    {
      name: "product_entitlement_overrides" as const,
      payload: ovrSnapshot,
      rows: ovrSnapshot.rows,
      errorCount: ovrErrors.length,
    },
    {
      name: "compliance_rules" as const,
      payload: compSnapshot,
      rows: compSnapshot.rows,
      errorCount: compErrors.length,
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

  const hasSev1XReg = xregErrors.some((e) => e.severity === "SEV-1");
  if (hasSev1 || hasSev1XReg) {
    const errorSummary = allErrors
      .map((e) => `[${e.severity}] ${e.ruleId}: ${e.reason}`)
      .join("\n");

    console.error(
      `[registry-sync] Validation FAILED — ${allErrors.length} error(s). Keeping last-known-good.`
    );

    await logRegistryEvent({
      environment,
      registryName: "all",
      eventType: "registry.promotion_blocked",
      severity: "SEV-1",
      reason: `${allErrors.length} validation error(s) blocked promotion`,
      details: { errorCount: allErrors.length, xregCount: xregErrors.length },
    });

    await maybeSendSevEmail({
      severity: "SEV-1",
      environment,
      registryName: "all",
      eventType: "registry.promotion_blocked",
      subject: `[SEV-1] Registry promotion blocked (${environment})`,
      bodyText: `Sync validation failed with ${allErrors.length} error(s):\n\n${errorSummary}`,
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
      `[registry-sync] ${allErrors.length} warning(s) — promoting anyway (no SEV-1):`,
      allErrors.map((e) => `[${e.severity}] ${e.ruleId}: ${e.reason}`).join("; ")
    );
  }

  for (const w of writtenIds) {
    await setActiveSnapshot({
      snapshotId: w.id,
      environment,
      registryName: w.name,
    });
    await setLastKnownGoodSnapshot({
      snapshotId: w.id,
      environment,
      registryName: w.name,
    });
  }

  const elapsed = Date.now() - startedAt;
  console.log(
    `[registry-sync] All 4 registries promoted to active + LKG (${elapsed}ms)`
  );

  await logRegistryEvent({
    environment,
    registryName: "all",
    eventType: "registry.sync_success",
    severity: "SEV-3",
    reason: `Synced in ${elapsed}ms`,
    details: {
      products: ppSnapshot.rows.length,
      entitlements: feSnapshot.rows.length,
      overrides: ovrSnapshot.rows.length,
      compliance: compSnapshot.rows.length,
    },
  });

  return {
    ok: true,
    elapsed,
    products: ppSnapshot.rows.length,
    entitlements: feSnapshot.rows.length,
    overrides: ovrSnapshot.rows.length,
    compliance: compSnapshot.rows.length,
  };
}
