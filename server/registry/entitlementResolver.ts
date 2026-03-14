import {
  getActiveRegistrySnapshot,
  type Environment,
} from "./snapshotStore";
import type {
  ProductRow,
  EntitlementRow,
  OverrideRow,
  ProductsPricingSnapshot,
  FeaturesEntitlementsSnapshot,
  ProductEntitlementOverridesSnapshot,
} from "./notionSync";
import { storage } from "../storage";

export type ResolvedEntitlement = {
  entitlementKey: string;
  type: "Limit" | "Flag";
  value: number;
  isUnlimited: boolean;
  enabled: boolean;
};

export type ResolvedEntitlements = Record<string, ResolvedEntitlement>;

function getEnvironment(): Environment {
  return process.env.REPLIT_DOMAINS ? "prod" : "staging";
}

async function loadFromAdminTables(): Promise<{
  products: ProductRow[];
  entitlements: EntitlementRow[];
  overrides: OverrideRow[];
} | null> {
  try {
    const [dbProducts, dbEntitlements, dbOverrides] = await Promise.all([
      storage.getAdminProducts(),
      storage.getAdminEntitlements(),
      storage.getAdminProductOverrides(),
    ]);

    if (dbProducts.length === 0 || dbEntitlements.length === 0) return null;

    const allPEs = await Promise.all(
      dbProducts.map((p) => storage.getAdminProductEntitlements(p.id))
    );

    const entIdMap = new Map(dbEntitlements.map((e) => [e.id, e]));

    const products: ProductRow[] = dbProducts.map((p, idx) => {
      const entitlementPageIds = allPEs[idx]
        .map((pe) => `ent-${pe.entitlementId}`)
        .filter((id) => {
          const numId = Number(id.replace("ent-", ""));
          return entIdMap.has(numId);
        });

      const stripePriceId =
        p.stripePriceIdMonthly || p.stripePriceIdYearly || p.stripePriceIdOneTime || "";
      const price = p.priceMonthly ?? p.priceYearly ?? p.priceOneTime ?? 0;
      let billingCycle = "Monthly";
      if (p.stripePriceIdYearly || (p.priceYearly && !p.priceMonthly)) {
        billingCycle = "Annual";
      }

      return {
        notionPageId: `admin-product-${p.id}`,
        productName: p.name,
        audience: p.audience,
        billingCycle,
        planType: p.planType,
        price,
        stripeProductId: p.stripeProductId || "",
        stripePriceId,
        trialDays: p.trialDays,
        logicKey: p.logicKey || "",
        status: p.status,
        entitlementPageIds,
        quotaSource: p.quotaSource || "",
        activeInstruction: p.activeInstruction || "",
      };
    });

    const monthlyDuplicates: ProductRow[] = [];
    for (const p of dbProducts) {
      if (
        p.billingType === "subscription" &&
        p.stripePriceIdMonthly &&
        p.stripePriceIdYearly
      ) {
        const idx = dbProducts.indexOf(p);
        const entitlementPageIds = allPEs[idx]
          .map((pe) => `ent-${pe.entitlementId}`);
        monthlyDuplicates.push({
          notionPageId: `admin-product-${p.id}-monthly`,
          productName: p.name,
          audience: p.audience,
          billingCycle: "Monthly",
          planType: p.planType,
          price: p.priceMonthly ?? 0,
          stripeProductId: p.stripeProductId || "",
          stripePriceId: p.stripePriceIdMonthly,
          trialDays: p.trialDays,
          logicKey: p.logicKey || "",
          status: p.status,
          entitlementPageIds,
          quotaSource: p.quotaSource || "",
          activeInstruction: p.activeInstruction || "",
        });

        const existingIdx = products.findIndex(
          (ep) => ep.notionPageId === `admin-product-${p.id}`
        );
        if (existingIdx >= 0) {
          products[existingIdx].billingCycle = "Annual";
          products[existingIdx].price = p.priceYearly ?? 0;
          products[existingIdx].stripePriceId = p.stripePriceIdYearly!;
        }
      }
    }
    products.push(...monthlyDuplicates);

    const entitlements: EntitlementRow[] = dbEntitlements.map((e) => ({
      notionPageId: `ent-${e.id}`,
      entitlementName: e.name,
      entitlementKey: e.key,
      type: e.type,
      unit: e.unit || "",
      defaultValue: e.defaultValue || "",
      status: e.status,
    }));

    const overrides: OverrideRow[] = dbOverrides.map((o) => ({
      notionPageId: `ovr-${o.id}`,
      overrideName: `Override ${o.id}`,
      productPageId: `admin-product-${o.productId}`,
      entitlementPageId: `ent-${o.entitlementId}`,
      value: o.value,
      isUnlimited: o.isUnlimited,
      enabled: o.enabled,
      status: o.status,
      notes: o.notes || "",
    }));

    const extraOverrides: OverrideRow[] = [];
    for (const o of dbOverrides) {
      const product = dbProducts.find((p) => p.id === o.productId);
      if (
        product &&
        product.billingType === "subscription" &&
        product.stripePriceIdMonthly &&
        product.stripePriceIdYearly
      ) {
        extraOverrides.push({
          notionPageId: `ovr-${o.id}-monthly`,
          overrideName: `Override ${o.id} Monthly`,
          productPageId: `admin-product-${o.productId}-monthly`,
          entitlementPageId: `ent-${o.entitlementId}`,
          value: o.value,
          isUnlimited: o.isUnlimited,
          enabled: o.enabled,
          status: o.status,
          notes: o.notes || "",
        });
      }
    }
    overrides.push(...extraOverrides);

    return { products, entitlements, overrides };
  } catch (err) {
    console.error("[entitlementResolver] Failed to load from admin tables:", err);
    return null;
  }
}

async function loadFromSnapshots(): Promise<{
  products: ProductRow[];
  entitlements: EntitlementRow[];
  overrides: OverrideRow[];
} | null> {
  const env = getEnvironment();

  const [ppSnap, feSnap, ovrSnap] = await Promise.all([
    getActiveRegistrySnapshot(env, "products_pricing"),
    getActiveRegistrySnapshot(env, "features_entitlements"),
    getActiveRegistrySnapshot(env, "product_entitlement_overrides"),
  ]);

  if (!ppSnap || !feSnap || !ovrSnap) {
    return null;
  }

  const pp = ppSnap.payload as ProductsPricingSnapshot;
  const fe = feSnap.payload as FeaturesEntitlementsSnapshot;
  const ovr = ovrSnap.payload as ProductEntitlementOverridesSnapshot;

  return { products: pp.rows, entitlements: fe.rows, overrides: ovr.rows };
}

async function loadSnapshots() {
  const adminData = await loadFromAdminTables();
  if (adminData) return adminData;
  return loadFromSnapshots();
}

function buildEntitlementMap(entitlements: EntitlementRow[]): Map<string, EntitlementRow> {
  return new Map(entitlements.map((e) => [e.notionPageId, e]));
}

function buildOverrideIndex(overrides: OverrideRow[]): Map<string, OverrideRow> {
  const index = new Map<string, OverrideRow>();
  for (const o of overrides) {
    if (o.status === "Active") {
      index.set(`${o.productPageId}::${o.entitlementPageId}`, o);
    }
  }
  return index;
}

function resolveForProduct(
  product: ProductRow,
  entitlements: EntitlementRow[],
  overrides: OverrideRow[]
): ResolvedEntitlements {
  const entMap = buildEntitlementMap(entitlements);
  const ovrIndex = buildOverrideIndex(overrides);
  const result: ResolvedEntitlements = {};

  for (const entPageId of product.entitlementPageIds) {
    const ent = entMap.get(entPageId);
    if (!ent) continue;

    const override = ovrIndex.get(`${product.notionPageId}::${entPageId}`);

    if (!override) {
      result[ent.entitlementKey] = {
        entitlementKey: ent.entitlementKey,
        type: ent.type as "Limit" | "Flag",
        value: 0,
        isUnlimited: false,
        enabled: false,
      };
      continue;
    }

    if (ent.type === "Limit") {
      result[ent.entitlementKey] = {
        entitlementKey: ent.entitlementKey,
        type: "Limit",
        value: override.isUnlimited ? Infinity : (override.value ?? 0),
        isUnlimited: override.isUnlimited,
        enabled: true,
      };
    } else {
      result[ent.entitlementKey] = {
        entitlementKey: ent.entitlementKey,
        type: "Flag",
        value: 0,
        isUnlimited: false,
        enabled: override.enabled,
      };
    }
  }

  return result;
}

export async function resolveEntitlements(
  stripePriceId: string
): Promise<ResolvedEntitlements | null> {
  const data = await loadSnapshots();
  if (!data) return null;

  const product = data.products.find((p) => p.stripePriceId === stripePriceId);
  if (!product) return null;

  return resolveForProduct(product, data.entitlements, data.overrides);
}

export async function resolveEntitlementsByPageId(
  notionPageId: string
): Promise<ResolvedEntitlements | null> {
  const data = await loadSnapshots();
  if (!data) return null;

  const product = data.products.find((p) => p.notionPageId === notionPageId);
  if (!product) return null;

  return resolveForProduct(product, data.entitlements, data.overrides);
}

function mergeAddOnEntitlements(
  base: ResolvedEntitlements,
  addOn: ResolvedEntitlements,
  addOnProductName: string
): ResolvedEntitlements {
  const merged = { ...base };

  for (const [key, addOnEnt] of Object.entries(addOn)) {
    const baseEnt = merged[key];
    if (!baseEnt) {
      merged[key] = addOnEnt;
      continue;
    }

    if (addOnEnt.type === "Limit" && baseEnt.type === "Limit") {
      if (addOnEnt.isUnlimited || baseEnt.isUnlimited) {
        merged[key] = { ...baseEnt, isUnlimited: true, value: Infinity };
      } else {
        merged[key] = { ...baseEnt, value: baseEnt.value + addOnEnt.value };
      }
    } else if (addOnEnt.type === "Flag") {
      merged[key] = { ...baseEnt, enabled: addOnEnt.enabled || baseEnt.enabled };
    }
  }

  return merged;
}

export async function resolveUserEntitlements(
  user: {
    id: number;
    role: string;
    stripeSubscriptionId?: string | null;
    resumeAccessExpiresAt?: Date | string | null;
    featuredEmployerExpiresAt?: Date | string | null;
  }
): Promise<ResolvedEntitlements> {
  const data = await loadSnapshots();
  if (!data) return {};

  if (user.role === "admin") {
    const adminProduct = data.products.find(
      (p) => p.planType === "Admin/Flag" && p.status === "Active"
    );
    if (adminProduct) {
      return resolveForProduct(adminProduct, data.entitlements, data.overrides);
    }
    const allUnlimited: ResolvedEntitlements = {};
    for (const ent of data.entitlements) {
      allUnlimited[ent.entitlementKey] = {
        entitlementKey: ent.entitlementKey,
        type: ent.type as "Limit" | "Flag",
        value: Infinity,
        isUnlimited: true,
        enabled: true,
      };
    }
    return allUnlimited;
  }

  let baseEntitlements: ResolvedEntitlements = {};

  if (user.stripeSubscriptionId) {
    try {
      const { getUncachableStripeClient } = await import("../stripeClient");
      const stripe = await getUncachableStripeClient();
      const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

      if (sub.status === "active" || sub.status === "trialing") {
        const priceId = sub.items.data[0]?.price?.id;
        if (priceId) {
          const product = data.products.find((p) => p.stripePriceId === priceId);
          if (product) {
            const ents = resolveForProduct(product, data.entitlements, data.overrides);
            if (ents && Object.keys(ents).length > 0) {
              baseEntitlements = ents;
            }
          }
        }
      }
    } catch (err) {
      console.error("[entitlementResolver] Stripe lookup failed:", err);
    }
  }

  if (Object.keys(baseEntitlements).length === 0) {
    const starterProduct = data.products.find(
      (p) =>
        p.status === "Active" &&
        p.planType === "Subscription" &&
        p.price === 0 &&
        !p.stripePriceId &&
        (p.audience === "Job Seeker" || p.logicKey?.toLowerCase().includes("starter"))
    );
    if (starterProduct) {
      baseEntitlements = resolveForProduct(starterProduct, data.entitlements, data.overrides);
    }
  }

  const now = new Date();

  if (user.resumeAccessExpiresAt) {
    const expiry = new Date(user.resumeAccessExpiresAt);
    if (expiry > now) {
      const resumeProduct = data.products.find(
        (p) =>
          p.status === "Active" &&
          p.planType === "Top-up" &&
          p.productName.toLowerCase().includes("resume")
      );
      if (resumeProduct) {
        const addOnEnts = resolveForProduct(resumeProduct, data.entitlements, data.overrides);
        baseEntitlements = mergeAddOnEntitlements(baseEntitlements, addOnEnts, resumeProduct.productName);
      }
    }
  }

  if (user.featuredEmployerExpiresAt) {
    const expiry = new Date(user.featuredEmployerExpiresAt);
    if (expiry > now) {
      const featuredProduct = data.products.find(
        (p) =>
          p.status === "Active" &&
          p.planType === "Top-up" &&
          p.productName.toLowerCase().includes("featured")
      );
      if (featuredProduct) {
        const addOnEnts = resolveForProduct(featuredProduct, data.entitlements, data.overrides);
        baseEntitlements = mergeAddOnEntitlements(baseEntitlements, addOnEnts, featuredProduct.productName);
      }
    }
  }

  return baseEntitlements;
}

export async function checkEntitlement(
  user: { id: number; role: string; stripeSubscriptionId?: string | null },
  key: string
): Promise<{ allowed: boolean; value?: number; isUnlimited?: boolean }> {
  const entitlements = await resolveUserEntitlements(user);
  const ent = entitlements[key];

  if (!ent) {
    return { allowed: false };
  }

  if (ent.type === "Flag") {
    return { allowed: ent.enabled };
  }

  return {
    allowed: ent.isUnlimited || ent.value > 0,
    value: ent.value,
    isUnlimited: ent.isUnlimited,
  };
}

function computeRollingWindow(userCreatedAt: Date | null): { windowStart: Date; windowEnd: Date } {
  const now = new Date();
  const anchor = userCreatedAt ? new Date(userCreatedAt) : now;
  const msPerDay = 24 * 60 * 60 * 1000;
  const windowDays = 30;

  const elapsed = now.getTime() - anchor.getTime();
  const completedWindows = Math.floor(elapsed / (windowDays * msPerDay));
  const windowStart = new Date(anchor.getTime() + completedWindows * windowDays * msPerDay);
  const windowEnd = new Date(windowStart.getTime() + windowDays * msPerDay);

  return { windowStart, windowEnd };
}

export async function consumeEntitlement(
  user: { id: number; role: string; createdAt?: Date | string | null; stripeSubscriptionId?: string | null },
  key: string,
  opts?: { sourceEvent?: string; refId?: number }
): Promise<{ allowed: boolean; consumed: boolean; source?: "free" | "credit"; remaining?: number; resetDate?: string; error?: string }> {
  const entitlements = await resolveUserEntitlements(user);
  const ent = entitlements[key];

  if (!ent) {
    return { allowed: false, consumed: false, error: "ENTITLEMENT_NOT_FOUND" };
  }

  if (ent.type === "Flag") {
    return { allowed: ent.enabled, consumed: false };
  }

  if (ent.isUnlimited) {
    return { allowed: true, consumed: true, source: "free" };
  }

  const quota = ent.value;
  if (quota <= 0) {
    return { allowed: false, consumed: false, error: "ENTITLEMENT_EXHAUSTED" };
  }

  const userCreatedAt = user.createdAt ? new Date(user.createdAt) : null;
  const { windowStart, windowEnd } = computeRollingWindow(userCreatedAt);

  const window = await storage.getOrCreateUsageWindow(user.id, key, windowStart, windowEnd);

  const updated = await storage.incrementUsageWindowAtomic(window.id, quota);
  if (updated) {
    return {
      allowed: true,
      consumed: true,
      source: "free",
      remaining: quota - updated.usedCount,
      resetDate: windowEnd.toISOString(),
    };
  }

  const grants = await storage.getActiveCreditGrants(user.id, key);
  for (const grant of grants) {
    const updated = await storage.consumeCreditFromGrant(grant.id, 1);
    if (updated) {
      await storage.createCreditConsumption({
        userId: user.id,
        entitlementKey: key,
        grantId: grant.id,
        amount: 1,
        consumedAt: new Date(),
        sourceEvent: opts?.sourceEvent || null,
        refId: opts?.refId || null,
      });
      const creditSummary = await storage.getUserCreditSummary(user.id, key);
      return {
        allowed: true,
        consumed: true,
        source: "credit",
        remaining: creditSummary.totalRemaining,
      };
    }
  }

  return {
    allowed: false,
    consumed: false,
    error: "ENTITLEMENT_EXHAUSTED",
    remaining: 0,
    resetDate: windowEnd.toISOString(),
  };
}

export async function getQuotaStatus(
  user: { id: number; role: string; createdAt?: Date | string | null; stripeSubscriptionId?: string | null },
  key: string
): Promise<{
  freeQuota: number;
  freeUsed: number;
  freeRemaining: number;
  isUnlimited: boolean;
  windowResetDate: string;
  creditPacks: { id: number; remaining: number; expiresAt: string; grantedAt: string }[];
  totalCredits: number;
}> {
  const entitlements = await resolveUserEntitlements(user);
  const ent = entitlements[key];

  const userCreatedAt = user.createdAt ? new Date(user.createdAt) : null;
  const { windowStart, windowEnd } = computeRollingWindow(userCreatedAt);

  const freeQuota = ent?.isUnlimited ? Infinity : (ent?.value ?? 0);
  const isUnlimited = ent?.isUnlimited ?? false;

  let freeUsed = 0;
  if (!isUnlimited) {
    const window = await storage.getOrCreateUsageWindow(user.id, key, windowStart, windowEnd);
    freeUsed = window.usedCount;
  }

  const creditSummary = await storage.getUserCreditSummary(user.id, key);

  return {
    freeQuota: isUnlimited ? -1 : freeQuota,
    freeUsed,
    freeRemaining: isUnlimited ? -1 : Math.max(0, freeQuota - freeUsed),
    isUnlimited,
    windowResetDate: windowEnd.toISOString(),
    creditPacks: creditSummary.grants.map(g => ({
      id: g.id,
      remaining: g.amountRemaining,
      expiresAt: g.expiresAt.toISOString(),
      grantedAt: g.grantedAt.toISOString(),
    })),
    totalCredits: creditSummary.totalRemaining,
  };
}

export async function getPricingData() {
  const data = await loadSnapshots();
  if (!data) return null;

  const entMap = buildEntitlementMap(data.entitlements);
  const ovrIndex = buildOverrideIndex(data.overrides);

  const visibleProducts = data.products.filter((p) => {
    if (p.status !== "Active") return false;
    if (p.planType === "Admin/Flag") return false;
    const isSellable =
      (p.planType === "Subscription" || p.planType === "Top-up") &&
      !!p.stripePriceId;
    const isFree =
      p.planType === "Subscription" && p.price === 0 && !p.stripePriceId;
    return isSellable || isFree;
  });

  const pricingProducts = visibleProducts.map((p) => {
    const features: { key: string; name: string; value: number; isUnlimited: boolean; enabled: boolean; type: string }[] = [];

    for (const entPageId of p.entitlementPageIds) {
      const ent = entMap.get(entPageId);
      if (!ent) continue;
      const override = ovrIndex.get(`${p.notionPageId}::${entPageId}`);
      features.push({
        key: ent.entitlementKey,
        name: ent.entitlementName,
        value: override?.isUnlimited ? Infinity : (override?.value ?? 0),
        isUnlimited: override?.isUnlimited ?? false,
        enabled: override?.enabled ?? false,
        type: ent.type,
      });
    }

    return {
      name: p.productName,
      audience: p.audience,
      billingCycle: p.billingCycle,
      planType: p.planType,
      price: p.price,
      trialDays: p.trialDays,
      stripePriceId: p.stripePriceId,
      logicKey: p.logicKey,
      features,
    };
  });

  return {
    products: pricingProducts,
    audiences: [...new Set(pricingProducts.map((p) => p.audience))],
  };
}
