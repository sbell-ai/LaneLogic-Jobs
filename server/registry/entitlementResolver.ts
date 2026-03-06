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

async function loadSnapshots() {
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
