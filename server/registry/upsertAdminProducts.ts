import { db } from "../db";
import {
  adminProducts,
  adminEntitlements,
  adminProductOverrides,
  adminProductEntitlements,
} from "@shared/schema";
import { eq, sql, and, isNull, isNotNull, notInArray } from "drizzle-orm";
import type {
  ProductsPricingSnapshot,
  FeaturesEntitlementsSnapshot,
  ProductEntitlementOverridesSnapshot,
  ProductRow,
  EntitlementRow,
  OverrideRow,
} from "./notionSync";

export type UpsertResult = {
  entitlements: { created: number; updated: number };
  products: { created: number; updated: number };
  overrides: { created: number; updated: number };
  archived: { products: number; entitlements: number; overrides: number };
};

export async function upsertAdminFromNotionSnapshots(
  ppSnapshot: ProductsPricingSnapshot,
  feSnapshot: FeaturesEntitlementsSnapshot,
  ovrSnapshot: ProductEntitlementOverridesSnapshot,
): Promise<UpsertResult> {
  const result: UpsertResult = {
    entitlements: { created: 0, updated: 0 },
    products: { created: 0, updated: 0 },
    overrides: { created: 0, updated: 0 },
    archived: { products: 0, entitlements: 0, overrides: 0 },
  };

  await db.transaction(async (tx) => {
    const entitlementNotionToDbId = new Map<string, number>();
    for (const ent of feSnapshot.rows) {
      const dbId = await upsertEntitlement(tx, ent, result);
      entitlementNotionToDbId.set(ent.notionPageId, dbId);
    }

    const activeEntNotionIds = feSnapshot.rows.map((e) => e.notionPageId);
    if (activeEntNotionIds.length > 0) {
      const archiveResult = await tx
        .update(adminEntitlements)
        .set({ status: "Archived", updatedAt: new Date() })
        .where(
          and(
            isNotNull(adminEntitlements.notionPageId),
            notInArray(adminEntitlements.notionPageId, activeEntNotionIds),
            sql`${adminEntitlements.status} != 'Archived'`,
          ),
        )
        .returning();
      result.archived.entitlements = archiveResult.length;
    }

    const productNotionToDbId = new Map<string, number>();
    for (const prod of ppSnapshot.rows) {
      const dbId = await upsertProduct(tx, prod, entitlementNotionToDbId, result);
      productNotionToDbId.set(prod.notionPageId, dbId);
    }

    const activeProdNotionIds = ppSnapshot.rows.map((p) => p.notionPageId);
    if (activeProdNotionIds.length > 0) {
      const archiveResult = await tx
        .update(adminProducts)
        .set({ status: "Archived", updatedAt: new Date() })
        .where(
          and(
            isNotNull(adminProducts.notionPageId),
            notInArray(adminProducts.notionPageId, activeProdNotionIds),
            sql`${adminProducts.status} != 'Archived'`,
          ),
        )
        .returning();
      result.archived.products = archiveResult.length;
    }

    const activeOvrNotionIds: string[] = [];
    for (const ovr of ovrSnapshot.rows) {
      const productDbId = productNotionToDbId.get(ovr.productPageId);
      const entitlementDbId = entitlementNotionToDbId.get(ovr.entitlementPageId);
      if (!productDbId || !entitlementDbId) continue;

      await upsertOverride(tx, ovr, productDbId, entitlementDbId, result);
      activeOvrNotionIds.push(ovr.notionPageId);
    }

    if (activeOvrNotionIds.length > 0) {
      const archiveResult = await tx
        .update(adminProductOverrides)
        .set({ status: "Archived", updatedAt: new Date() })
        .where(
          and(
            isNotNull(adminProductOverrides.notionPageId),
            notInArray(adminProductOverrides.notionPageId, activeOvrNotionIds),
            sql`${adminProductOverrides.status} != 'Archived'`,
          ),
        )
        .returning();
      result.archived.overrides = archiveResult.length;
    }
  });

  console.log(
    `[upsert-admin] Done: products=${result.products.created}c/${result.products.updated}u, ` +
      `entitlements=${result.entitlements.created}c/${result.entitlements.updated}u, ` +
      `overrides=${result.overrides.created}c/${result.overrides.updated}u`,
  );

  return result;
}

async function upsertEntitlement(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ent: EntitlementRow,
  result: UpsertResult,
): Promise<number> {
  const [existing] = await tx
    .select()
    .from(adminEntitlements)
    .where(eq(adminEntitlements.notionPageId, ent.notionPageId))
    .limit(1);

  if (existing) {
    await tx
      .update(adminEntitlements)
      .set({
        name: ent.entitlementName,
        key: ent.entitlementKey,
        type: ent.type,
        unit: ent.unit || null,
        defaultValue: ent.defaultValue || null,
        status: ent.status || "Active",
        updatedAt: new Date(),
      })
      .where(eq(adminEntitlements.id, existing.id));
    result.entitlements.updated++;
    return existing.id;
  }

  const [created] = await tx
    .insert(adminEntitlements)
    .values({
      notionPageId: ent.notionPageId,
      name: ent.entitlementName,
      key: ent.entitlementKey,
      type: ent.type,
      unit: ent.unit || null,
      defaultValue: ent.defaultValue || null,
      status: ent.status || "Active",
    })
    .onConflictDoUpdate({
      target: adminEntitlements.key,
      set: {
        notionPageId: ent.notionPageId,
        name: ent.entitlementName,
        type: ent.type,
        unit: ent.unit || null,
        defaultValue: ent.defaultValue || null,
        status: ent.status || "Active",
        updatedAt: new Date(),
      },
    })
    .returning();
  result.entitlements.created++;
  return created.id;
}

async function upsertProduct(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  prod: ProductRow,
  entitlementNotionToDbId: Map<string, number>,
  result: UpsertResult,
): Promise<number> {
  const rawAudience = (prod.audience || "").toLowerCase();
  const normalizedAudience = rawAudience.includes("employer")
    ? "employer"
    : "job_seeker";
  const isYearly =
    prod.billingCycle === "Yearly" || prod.billingCycle === "Annual";

  const values = {
    name: prod.productName,
    audience: normalizedAudience,
    kind: prod.planType === "Top-up" ? "add_on" : ("base_plan" as string),
    billingType: prod.planType === "Top-up" ? "one_time" : ("subscription" as string),
    priceMonthly: prod.billingCycle === "Monthly" ? prod.price : null,
    priceYearly: isYearly ? prod.price : null,
    priceOneTime: prod.planType === "Top-up" ? prod.price : null,
    stripeProductId: prod.stripeProductId || null,
    stripePriceIdMonthly:
      prod.billingCycle === "Monthly" ? prod.stripePriceId : null,
    stripePriceIdYearly: isYearly ? prod.stripePriceId : null,
    stripePriceIdOneTime:
      prod.planType === "Top-up" ? prod.stripePriceId : null,
    logicKey: prod.logicKey || null,
    trialDays: prod.trialDays || 0,
    status: prod.status || "Active",
    planType: prod.planType || "Subscription",
    quotaSource: prod.quotaSource || null,
    activeInstruction: prod.activeInstruction || null,
  };

  const [existing] = await tx
    .select()
    .from(adminProducts)
    .where(eq(adminProducts.notionPageId, prod.notionPageId))
    .limit(1);

  let dbId: number;

  if (existing) {
    await tx
      .update(adminProducts)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(adminProducts.id, existing.id));
    result.products.updated++;
    dbId = existing.id;
  } else {
    const [created] = await tx
      .insert(adminProducts)
      .values({ ...values, notionPageId: prod.notionPageId })
      .returning();
    result.products.created++;
    dbId = created.id;
  }

  const entitlementIds = prod.entitlementPageIds
    .map((epid) => entitlementNotionToDbId.get(epid))
    .filter((id): id is number => id !== undefined);

  await tx
    .delete(adminProductEntitlements)
    .where(eq(adminProductEntitlements.productId, dbId));

  if (entitlementIds.length > 0) {
    await tx.insert(adminProductEntitlements).values(
      entitlementIds.map((eid) => ({ productId: dbId, entitlementId: eid })),
    );
  }

  return dbId;
}

async function upsertOverride(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ovr: OverrideRow,
  productDbId: number,
  entitlementDbId: number,
  result: UpsertResult,
): Promise<void> {
  const values = {
    productId: productDbId,
    entitlementId: entitlementDbId,
    value: ovr.value,
    isUnlimited: ovr.isUnlimited,
    enabled: ovr.enabled,
    status: ovr.status || "Active",
    notes: ovr.notes || null,
  };

  const [existing] = await tx
    .select()
    .from(adminProductOverrides)
    .where(eq(adminProductOverrides.notionPageId, ovr.notionPageId))
    .limit(1);

  if (existing) {
    await tx
      .update(adminProductOverrides)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(adminProductOverrides.id, existing.id));
    result.overrides.updated++;
  } else {
    try {
      await tx
        .insert(adminProductOverrides)
        .values({ ...values, notionPageId: ovr.notionPageId });
      result.overrides.created++;
    } catch (err: any) {
      if (err.message?.includes("duplicate key") && err.message?.includes("product_entitlement")) {
        await tx
          .update(adminProductOverrides)
          .set({
            ...values,
            notionPageId: ovr.notionPageId,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(adminProductOverrides.productId, productDbId),
              eq(adminProductOverrides.entitlementId, entitlementDbId),
            ),
          );
        result.overrides.updated++;
      } else {
        throw err;
      }
    }
  }
}

export async function cleanupDuplicateAdminProducts(): Promise<number> {
  const allProducts = await db
    .select()
    .from(adminProducts)
    .where(isNull(adminProducts.notionPageId));

  const seen = new Map<string, number>();
  const toDelete: number[] = [];

  for (const p of allProducts) {
    const key = `${p.name}::${p.audience}`;
    if (seen.has(key)) {
      toDelete.push(Math.max(p.id, seen.get(key)!));
      seen.set(key, Math.min(p.id, seen.get(key)!));
    } else {
      seen.set(key, p.id);
    }
  }

  for (const id of toDelete) {
    await db
      .delete(adminProductEntitlements)
      .where(eq(adminProductEntitlements.productId, id));
    await db
      .delete(adminProductOverrides)
      .where(eq(adminProductOverrides.productId, id));
    await db.delete(adminProducts).where(eq(adminProducts.id, id));
  }

  if (toDelete.length > 0) {
    console.log(
      `[upsert-admin] Cleaned up ${toDelete.length} duplicate admin_products (no notion_page_id, kept lowest ID)`,
    );
  }

  return toDelete.length;
}
