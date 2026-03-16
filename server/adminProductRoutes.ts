import { type Express, type Request, type Response } from "express";
import { storage } from "./storage";
import { z } from "zod";
import type {
  ProductRow,
  EntitlementRow,
  OverrideRow,
  ProductsPricingSnapshot,
  FeaturesEntitlementsSnapshot,
  ProductEntitlementOverridesSnapshot,
} from "./registry/notionSync";
import {
  getActiveRegistrySnapshot,
  type Environment,
} from "./registry/snapshotStore";
import { syncAllRegistries } from "./registry/syncAll";
import { upsertAdminFromNotionSnapshots, cleanupDuplicateAdminProducts } from "./registry/upsertAdminProducts";

function requireAdmin(req: Request, res: Response): boolean {
  const user = (req as any).user;
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

const productSchema = z.object({
  name: z.string().min(1),
  audience: z.string().min(1),
  kind: z.string().min(1),
  billingType: z.string().min(1),
  priceMonthly: z.number().nullable().optional(),
  priceYearly: z.number().nullable().optional(),
  priceOneTime: z.number().nullable().optional(),
  stripeProductId: z.string().nullable().optional(),
  stripePriceIdMonthly: z.string().nullable().optional(),
  stripePriceIdYearly: z.string().nullable().optional(),
  stripePriceIdOneTime: z.string().nullable().optional(),
  logicKey: z.string().nullable().optional(),
  trialDays: z.number().int().min(0).default(0),
  status: z.enum(["Active", "Inactive"]).default("Active"),
  planType: z.string().default("Subscription"),
  quotaSource: z.string().nullable().optional(),
  activeInstruction: z.string().nullable().optional(),
  grantEntitlementKey: z.string().nullable().optional(),
  grantAmount: z.number().int().positive().nullable().optional(),
  creditExpiryMonths: z.number().int().positive().nullable().optional(),
  entitlementIds: z.array(z.number()).optional(),
});

const entitlementSchema = z.object({
  name: z.string().min(1),
  key: z.string().min(1),
  type: z.enum(["Limit", "Flag"]),
  unit: z.string().nullable().optional(),
  defaultValue: z.string().nullable().optional(),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});

const overrideSchema = z.object({
  productId: z.number().int(),
  entitlementId: z.number().int(),
  value: z.number().nullable().optional(),
  isUnlimited: z.boolean().default(false),
  enabled: z.boolean().default(false),
  status: z.enum(["Active", "Inactive"]).default("Active"),
  notes: z.string().nullable().optional(),
});

export function registerAdminProductRoutes(app: Express) {
  // ---- Products CRUD ----
  app.get("/api/admin/products", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const products = await storage.getAdminProducts();
      const enriched = await Promise.all(
        products.map(async (p) => {
          const pes = await storage.getAdminProductEntitlements(p.id);
          return { ...p, entitlementIds: pes.map((pe) => pe.entitlementId) };
        })
      );
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/products/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const product = await storage.getAdminProduct(Number(req.params.id));
      if (!product) return res.status(404).json({ error: "Product not found" });
      const pes = await storage.getAdminProductEntitlements(product.id);
      const overrides = await storage.getAdminProductOverrides(product.id);
      res.json({ ...product, entitlementIds: pes.map((pe) => pe.entitlementId), overrides });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/products", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const parsed = productSchema.parse(req.body);
      const { entitlementIds, ...productData } = parsed;

      const activeProducts = await storage.getAdminProducts();
      const duplicate = activeProducts.find(
        (p) => p.name === parsed.name && p.status === "Active"
      );
      if (duplicate) {
        return res.status(409).json({ error: `Active product "${parsed.name}" already exists` });
      }

      let stripeProductId = productData.stripeProductId;
      let stripePriceIdMonthly = productData.stripePriceIdMonthly;
      let stripePriceIdYearly = productData.stripePriceIdYearly;
      let stripePriceIdOneTime = productData.stripePriceIdOneTime;

      const hasPaidPrice =
        (productData.priceMonthly && productData.priceMonthly > 0) ||
        (productData.priceYearly && productData.priceYearly > 0) ||
        (productData.priceOneTime && productData.priceOneTime > 0);

      if (hasPaidPrice && !stripeProductId) {
        try {
          const { getUncachableStripeClient } = await import("./stripeClient");
          const stripe = await getUncachableStripeClient();

          const stripeProduct = await stripe.products.create({
            name: productData.name,
            metadata: { audience: productData.audience, logicKey: productData.logicKey || "" },
          });
          stripeProductId = stripeProduct.id;

          if (productData.billingType === "subscription") {
            if (productData.priceMonthly && productData.priceMonthly > 0) {
              const price = await stripe.prices.create({
                product: stripeProductId,
                unit_amount: Math.round(productData.priceMonthly * 100),
                currency: "usd",
                recurring: { interval: "month" },
              });
              stripePriceIdMonthly = price.id;
            }
            if (productData.priceYearly && productData.priceYearly > 0) {
              const price = await stripe.prices.create({
                product: stripeProductId,
                unit_amount: Math.round(productData.priceYearly * 100),
                currency: "usd",
                recurring: { interval: "year" },
              });
              stripePriceIdYearly = price.id;
            }
          } else {
            if (productData.priceOneTime && productData.priceOneTime > 0) {
              const price = await stripe.prices.create({
                product: stripeProductId,
                unit_amount: Math.round(productData.priceOneTime * 100),
                currency: "usd",
              });
              stripePriceIdOneTime = price.id;
            }
          }
        } catch (stripeErr: any) {
          console.error("[adminProducts] Stripe create failed:", stripeErr.message);
          return res.status(500).json({ error: `Stripe error: ${stripeErr.message}` });
        }
      }

      const product = await storage.createAdminProduct({
        ...productData,
        stripeProductId: stripeProductId || null,
        stripePriceIdMonthly: stripePriceIdMonthly || null,
        stripePriceIdYearly: stripePriceIdYearly || null,
        stripePriceIdOneTime: stripePriceIdOneTime || null,
      });

      if (entitlementIds && entitlementIds.length > 0) {
        await storage.setAdminProductEntitlements(product.id, entitlementIds);
      }

      const pes = await storage.getAdminProductEntitlements(product.id);
      res.status(201).json({ ...product, entitlementIds: pes.map((pe) => pe.entitlementId) });
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ error: "Validation failed", details: err.errors });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/admin/products/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const id = Number(req.params.id);
      const existing = await storage.getAdminProduct(id);
      if (!existing) return res.status(404).json({ error: "Product not found" });

      const parsed = productSchema.partial().parse(req.body);
      const { entitlementIds, ...updates } = parsed;

      if (updates.name && updates.name !== existing.name) {
        const activeProducts = await storage.getAdminProducts();
        const duplicate = activeProducts.find(
          (p) => p.name === updates.name && p.status === "Active" && p.id !== id
        );
        if (duplicate) {
          return res.status(409).json({ error: `Active product "${updates.name}" already exists` });
        }
      }

      if (existing.stripeProductId) {
        const { getUncachableStripeClient } = await import("./stripeClient");
        const stripe = await getUncachableStripeClient();

        const createNewStripePrice = async (
          amount: number,
          interval: "month" | "year" | null
        ): Promise<string> => {
          const newPrice = await stripe.prices.create({
            product: existing.stripeProductId!,
            unit_amount: Math.round(amount * 100),
            currency: "usd",
            ...(interval ? { recurring: { interval } } : {}),
          });
          return newPrice.id;
        };

        if (updates.priceMonthly !== undefined && updates.priceMonthly !== null && updates.priceMonthly !== existing.priceMonthly) {
          const newId = await createNewStripePrice(updates.priceMonthly, "month");
          if (existing.stripePriceIdMonthly) {
            await stripe.prices.update(existing.stripePriceIdMonthly, { active: false }).catch(() => {});
          }
          updates.stripePriceIdMonthly = newId;
        }
        if (updates.priceYearly !== undefined && updates.priceYearly !== null && updates.priceYearly !== existing.priceYearly) {
          const newId = await createNewStripePrice(updates.priceYearly, "year");
          if (existing.stripePriceIdYearly) {
            await stripe.prices.update(existing.stripePriceIdYearly, { active: false }).catch(() => {});
          }
          updates.stripePriceIdYearly = newId;
        }
        if (updates.priceOneTime !== undefined && updates.priceOneTime !== null && updates.priceOneTime !== existing.priceOneTime) {
          const newId = await createNewStripePrice(updates.priceOneTime, null);
          if (existing.stripePriceIdOneTime) {
            await stripe.prices.update(existing.stripePriceIdOneTime, { active: false }).catch(() => {});
          }
          updates.stripePriceIdOneTime = newId;
        }
      }

      const product = await storage.updateAdminProduct(id, updates);
      if (entitlementIds !== undefined) {
        await storage.setAdminProductEntitlements(id, entitlementIds);
      }

      const pes = await storage.getAdminProductEntitlements(product.id);
      res.json({ ...product, entitlementIds: pes.map((pe) => pe.entitlementId) });
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ error: "Validation failed", details: err.errors });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/admin/products/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const id = Number(req.params.id);
      const existing = await storage.getAdminProduct(id);
      if (!existing) return res.status(404).json({ error: "Product not found" });

      await storage.deleteAdminProduct(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---- Entitlements CRUD ----
  app.get("/api/admin/entitlements", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      res.json(await storage.getAdminEntitlements());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/entitlements", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const parsed = entitlementSchema.parse(req.body);
      const entitlement = await storage.createAdminEntitlement(parsed);
      res.status(201).json(entitlement);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ error: "Validation failed", details: err.errors });
      }
      if (err.message?.includes("unique")) {
        return res.status(409).json({ error: `Entitlement key "${req.body.key}" already exists` });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/admin/entitlements/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const id = Number(req.params.id);
      const existing = await storage.getAdminEntitlement(id);
      if (!existing) return res.status(404).json({ error: "Entitlement not found" });
      const parsed = entitlementSchema.partial().parse(req.body);
      const entitlement = await storage.updateAdminEntitlement(id, parsed);
      res.json(entitlement);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ error: "Validation failed", details: err.errors });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/admin/entitlements/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const id = Number(req.params.id);
      const existing = await storage.getAdminEntitlement(id);
      if (!existing) return res.status(404).json({ error: "Entitlement not found" });
      await storage.deleteAdminEntitlement(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---- Overrides CRUD ----
  app.get("/api/admin/product-overrides", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const productId = req.query.productId ? Number(req.query.productId) : undefined;
      res.json(await storage.getAdminProductOverrides(productId));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/product-overrides", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const parsed = overrideSchema.parse(req.body);
      const override = await storage.createAdminProductOverride(parsed);
      res.status(201).json(override);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ error: "Validation failed", details: err.errors });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/admin/product-overrides/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const id = Number(req.params.id);
      const existing = await storage.getAdminProductOverride(id);
      if (!existing) return res.status(404).json({ error: "Override not found" });
      const parsed = overrideSchema.partial().parse(req.body);
      const override = await storage.updateAdminProductOverride(id, parsed);
      res.json(override);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ error: "Validation failed", details: err.errors });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/admin/product-overrides/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const id = Number(req.params.id);
      const existing = await storage.getAdminProductOverride(id);
      if (!existing) return res.status(404).json({ error: "Override not found" });
      await storage.deleteAdminProductOverride(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---- Seed from Snapshot ----
  app.post("/api/admin/products/seed-from-snapshot", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const migrationKey = "seed_from_notion_snapshot";
      const existing = await storage.getMigrationState(migrationKey);
      if (existing?.completedAt) {
        return res.status(409).json({
          error: "Seed already completed",
          completedAt: existing.completedAt,
          result: existing.result,
        });
      }

      const env: Environment = process.env.REPLIT_DOMAINS ? "prod" : "staging";
      const [ppSnap, feSnap, ovrSnap] = await Promise.all([
        getActiveRegistrySnapshot(env, "products_pricing"),
        getActiveRegistrySnapshot(env, "features_entitlements"),
        getActiveRegistrySnapshot(env, "product_entitlement_overrides"),
      ]);

      if (!ppSnap || !feSnap || !ovrSnap) {
        return res.status(404).json({ error: "No active registry snapshots found" });
      }

      const pp = ppSnap.payload as ProductsPricingSnapshot;
      const fe = feSnap.payload as FeaturesEntitlementsSnapshot;
      const ovr = ovrSnap.payload as ProductEntitlementOverridesSnapshot;

      const entitlementMap = new Map<string, number>();
      for (const ent of fe.rows) {
        try {
          const created = await storage.createAdminEntitlement({
            name: ent.entitlementName,
            key: ent.entitlementKey,
            type: ent.type,
            unit: ent.unit || null,
            defaultValue: ent.defaultValue || null,
            status: ent.status || "Active",
          });
          entitlementMap.set(ent.notionPageId, created.id);
        } catch (err: any) {
          console.warn(`[seed] Skipping entitlement "${ent.entitlementKey}":`, err.message);
        }
      }

      const productMap = new Map<string, number>();
      for (const prod of pp.rows) {
        try {
          const rawAudience = (prod.audience || "").toLowerCase();
          const normalizedAudience = rawAudience.includes("employer") ? "employer" : "job_seeker";
          const isYearly = prod.billingCycle === "Yearly" || prod.billingCycle === "Annual";
          const created = await storage.createAdminProduct({
            name: prod.productName,
            audience: normalizedAudience,
            kind: prod.planType === "Top-up" ? "add_on" : "base_plan",
            billingType: prod.planType === "Top-up" ? "one_time" : "subscription",
            priceMonthly: prod.billingCycle === "Monthly" ? prod.price : null,
            priceYearly: isYearly ? prod.price : null,
            priceOneTime: prod.planType === "Top-up" ? prod.price : null,
            stripeProductId: prod.stripeProductId || null,
            stripePriceIdMonthly: prod.billingCycle === "Monthly" ? prod.stripePriceId : null,
            stripePriceIdYearly: isYearly ? prod.stripePriceId : null,
            stripePriceIdOneTime: prod.planType === "Top-up" ? prod.stripePriceId : null,
            logicKey: prod.logicKey || null,
            trialDays: prod.trialDays || 0,
            status: prod.status || "Active",
            planType: prod.planType || "Subscription",
            quotaSource: prod.quotaSource || null,
            activeInstruction: prod.activeInstruction || null,
          });
          productMap.set(prod.notionPageId, created.id);

          const entitlementIds = prod.entitlementPageIds
            .map((epid) => entitlementMap.get(epid))
            .filter((id): id is number => id !== undefined);
          if (entitlementIds.length > 0) {
            await storage.setAdminProductEntitlements(created.id, entitlementIds);
          }
        } catch (err: any) {
          console.warn(`[seed] Skipping product "${prod.productName}":`, err.message);
        }
      }

      let overridesCreated = 0;
      for (const o of ovr.rows) {
        try {
          const productId = productMap.get(o.productPageId);
          const entitlementId = entitlementMap.get(o.entitlementPageId);
          if (!productId || !entitlementId) continue;

          await storage.createAdminProductOverride({
            productId,
            entitlementId,
            value: o.value,
            isUnlimited: o.isUnlimited,
            enabled: o.enabled,
            status: o.status || "Active",
            notes: o.notes || null,
          });
          overridesCreated++;
        } catch (err: any) {
          console.warn(`[seed] Skipping override:`, err.message);
        }
      }

      const result = {
        products: productMap.size,
        entitlements: entitlementMap.size,
        overrides: overridesCreated,
      };

      await storage.setMigrationState({
        key: migrationKey,
        completedAt: new Date(),
        result,
      });

      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/registry-sync/products", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const environment: Environment = process.env.NODE_ENV === "production" ? "prod" : "staging";
      const syncResult = await syncAllRegistries({ environment });

      await cleanupDuplicateAdminProducts();

      const env: Environment = process.env.REPLIT_DOMAINS ? "prod" : "staging";
      const [ppSnap, feSnap, ovrSnap] = await Promise.all([
        getActiveRegistrySnapshot(env, "products_pricing"),
        getActiveRegistrySnapshot(env, "features_entitlements"),
        getActiveRegistrySnapshot(env, "product_entitlement_overrides"),
      ]);

      let upsertResult = null;
      if (ppSnap && feSnap && ovrSnap) {
        upsertResult = await upsertAdminFromNotionSnapshots(
          ppSnap.payload as ProductsPricingSnapshot,
          feSnap.payload as FeaturesEntitlementsSnapshot,
          ovrSnap.payload as ProductEntitlementOverridesSnapshot,
        );
      }

      res.json({
        ...syncResult,
        upsert: upsertResult,
      });
    } catch (err: any) {
      console.error("[registry-sync/products] Error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/products/sync-from-stripe", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();

      const stripeProducts = await stripe.products.list({ active: true, limit: 100 });
      const existingProducts = await storage.getAdminProducts();
      const existingByStripeId = new Map(
        existingProducts
          .filter((p) => p.stripeProductId)
          .map((p) => [p.stripeProductId!, p])
      );

      let created = 0;
      let updated = 0;
      const discrepancies: Array<{ productName: string; field: string; adminValue: number | null; stripeValue: number | null }> = [];

      for (const sp of stripeProducts.data) {
        const prices = await stripe.prices.list({ product: sp.id, active: true, limit: 20 });

        let monthlyPriceId: string | null = null;
        let yearlyPriceId: string | null = null;
        let oneTimePriceId: string | null = null;
        let monthlyAmount: number | null = null;
        let yearlyAmount: number | null = null;
        let oneTimeAmount: number | null = null;

        for (const price of prices.data) {
          const amount = price.unit_amount != null ? price.unit_amount / 100 : null;
          if (price.type === "recurring") {
            if (price.recurring?.interval === "month") {
              monthlyPriceId = price.id;
              monthlyAmount = amount;
            } else if (price.recurring?.interval === "year") {
              yearlyPriceId = price.id;
              yearlyAmount = amount;
            }
          } else if (price.type === "one_time") {
            oneTimePriceId = price.id;
            oneTimeAmount = amount;
          }
        }

        const existing = existingByStripeId.get(sp.id);

        if (existing) {
          await storage.updateAdminProduct(existing.id, {
            stripePriceIdMonthly: monthlyPriceId,
            stripePriceIdYearly: yearlyPriceId,
            stripePriceIdOneTime: oneTimePriceId,
          });

          if (monthlyAmount !== null && existing.priceMonthly !== null && Math.abs(monthlyAmount - existing.priceMonthly) > 0.01) {
            discrepancies.push({ productName: sp.name, field: "priceMonthly", adminValue: existing.priceMonthly, stripeValue: monthlyAmount });
          }
          if (yearlyAmount !== null && existing.priceYearly !== null && Math.abs(yearlyAmount - existing.priceYearly) > 0.01) {
            discrepancies.push({ productName: sp.name, field: "priceYearly", adminValue: existing.priceYearly, stripeValue: yearlyAmount });
          }
          if (oneTimeAmount !== null && existing.priceOneTime !== null && Math.abs(oneTimeAmount - existing.priceOneTime) > 0.01) {
            discrepancies.push({ productName: sp.name, field: "priceOneTime", adminValue: existing.priceOneTime, stripeValue: oneTimeAmount });
          }

          updated++;
        } else {
          const isOneTime = !monthlyPriceId && !yearlyPriceId && !!oneTimePriceId;
          const rawAudience = (sp.metadata?.audience as string) || "";
          const audience = rawAudience.toLowerCase().includes("employer") ? "employer" : "job_seeker";
          const kind = isOneTime ? "add_on" : "base_plan";
          const billingType = isOneTime ? "one_time" : "subscription";
          const planType = isOneTime ? "Top-up" : "Subscription";

          await storage.createAdminProduct({
            name: sp.name,
            audience,
            kind,
            billingType,
            priceMonthly: monthlyAmount,
            priceYearly: yearlyAmount,
            priceOneTime: oneTimeAmount,
            stripeProductId: sp.id,
            stripePriceIdMonthly: monthlyPriceId,
            stripePriceIdYearly: yearlyPriceId,
            stripePriceIdOneTime: oneTimePriceId,
            logicKey: (sp.metadata?.logicKey as string) || null,
            trialDays: 0,
            status: "Active",
            planType,
          });
          created++;
        }
      }

      res.json({ success: true, created, updated, total: stripeProducts.data.length, discrepancies });
    } catch (err: any) {
      console.error("[stripe-sync] Error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/products/seed-status", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const state = await storage.getMigrationState("seed_from_notion_snapshot");
      res.json({ seeded: !!state?.completedAt, completedAt: state?.completedAt || null, result: state?.result || null });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/products/seed-reset", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { db } = await import("./db");
      const schema = await import("@shared/schema");
      await db.delete(schema.adminProductOverrides);
      await db.delete(schema.adminProductEntitlements);
      await db.delete(schema.adminProducts);
      await db.delete(schema.adminEntitlements);
      await db.delete(schema.migrationState);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
