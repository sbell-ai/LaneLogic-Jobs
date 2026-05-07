import { Router } from "express";
import { storage } from "../storage";
import { getPricingData, resolveUserEntitlements, getQuotaStatus } from "../registry/entitlementResolver";

const router = Router();

// Stripe public key (for frontend)
router.get("/api/payments/config", async (req, res) => {
  try {
    const { getStripePublishableKey } = await import("../stripeClient");
    const publishableKey = await getStripePublishableKey();
    res.json({ publishableKey });
  } catch {
    res.status(503).json({ message: "Payment system not configured." });
  }
});

router.get("/api/user/entitlements", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  try {
    const user = req.user as any;
    const entitlements = await resolveUserEntitlements(user);
    res.json({ entitlements });
  } catch (err: any) {
    console.error("Entitlements error:", err);
    res.status(500).json({ message: "Failed to load entitlements" });
  }
});

router.get("/api/user/quota-status", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  try {
    const user = req.user as any;
    const keys = ["applications_per_month", "job_posts_per_month"];
    const quotas: Record<string, any> = {};
    for (const key of keys) {
      quotas[key] = await getQuotaStatus(user, key);
    }
    res.json({ quotas });
  } catch (err: any) {
    console.error("Quota status error:", err);
    res.status(500).json({ message: "Failed to load quota status" });
  }
});

router.get("/api/registry/pricing", async (_req, res) => {
  try {
    const data = await getPricingData();
    if (!data) {
      return res.status(503).json({ message: "Pricing data not available yet" });
    }
    res.json(data);
  } catch (err: any) {
    console.error("Pricing data error:", err);
    res.status(500).json({ message: "Failed to load pricing data" });
  }
});

router.post("/api/payments/create-checkout-session", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const { stripePriceId, tier, planType } = req.body;

  try {
    const { getUncachableStripeClient } = await import("../stripeClient");
    const stripe = await getUncachableStripeClient();
    const user = req.user as any;

    let resolvedPriceId = stripePriceId || null;
    const isTopUp = planType === "Top-up";

    if (!resolvedPriceId && tier && ["basic", "premium"].includes(tier)) {
      const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
      const roleLabel = user.role === "employer" ? "Employer" : "Job Seeker";
      const productName = `LaneLogic Jobs ${tierLabel} - ${roleLabel}`;
      const products = await stripe.products.search({ query: `name:'${productName}' AND active:'true'` });
      if (products.data.length > 0) {
        const prices = await stripe.prices.list({ product: products.data[0].id, active: true, limit: 1 });
        if (prices.data.length > 0) resolvedPriceId = prices.data[0].id;
      }
    }

    if (!resolvedPriceId) {
      return res.status(400).json({ message: "No valid price found for this plan" });
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: String(user.id) },
      });
      customerId = customer.id;
      await storage.updateUser(user.id, { stripeCustomerId: customerId } as any);
    }

    const sessionParams: any = {
      customer: customerId,
      payment_method_types: ["card"],
      mode: isTopUp ? "payment" : "subscription",
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      success_url: isTopUp
        ? `${req.protocol}://${req.get("host")}/dashboard/membership?success=true&addon=true&session_id={CHECKOUT_SESSION_ID}`
        : `${req.protocol}://${req.get("host")}/dashboard/membership?success=true`,
      cancel_url: `${req.protocol}://${req.get("host")}/pricing`,
      metadata: { userId: String(user.id), tier: tier || "", planType: planType || "Subscription", stripePriceId: resolvedPriceId },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);
    res.json({ url: session.url, sessionId: session.id });
  } catch (err: any) {
    console.error("Stripe checkout error:", err);
    res.status(500).json({ message: err.message || "Payment error" });
  }
});

const fulfilledSessions = new Set<string>();

router.post("/api/payments/fulfill-addon", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ message: "Missing sessionId" });

  if (fulfilledSessions.has(sessionId)) {
    return res.json({ message: "Already fulfilled", alreadyFulfilled: true });
  }

  try {
    const { getUncachableStripeClient } = await import("../stripeClient");
    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const userId = parseInt(session.metadata?.userId || "0", 10);
    const user = req.user as any;
    if (userId !== user.id) {
      return res.status(403).json({ message: "Session does not belong to this user" });
    }

    const { fulfillTopUpFromSession } = await import("../utils/fulfillTopUp");
    const result = await fulfillTopUpFromSession({
      payment_status: session.payment_status,
      payment_intent: session.payment_intent as string | null,
      metadata: session.metadata as Record<string, string> | null,
    });

    if (!result.fulfilled) {
      return res.status(400).json({ message: (result as any).reason });
    }

    fulfilledSessions.add(sessionId);

    if (result.type === "already_fulfilled") {
      return res.json({ message: "Already fulfilled", alreadyFulfilled: true });
    }
    if (result.type === "credit_grant") {
      return res.json({ message: `${result.credits} credits granted`, credits: result.credits, expiresAt: result.expiresAt });
    }
    if (result.type === "resume_access") {
      return res.json({ message: "Resume Access activated", expiresAt: result.expiresAt });
    }
    if (result.type === "featured_employer") {
      return res.json({ message: "Featured Employer activated", expiresAt: result.expiresAt });
    }

    return res.json({ message: "Fulfilled" });
  } catch (err: any) {
    console.error("Add-on fulfillment error:", err);
    res.status(500).json({ message: err.message || "Fulfillment error" });
  }
});

// Customer portal (manage subscription)
router.post("/api/payments/portal", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
  const user = req.user as any;
  if (!user.stripeCustomerId) return res.status(400).json({ message: "No active subscription" });

  try {
    const { getUncachableStripeClient } = await import("../stripeClient");
    const stripe = await getUncachableStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${req.protocol}://${req.get("host")}/dashboard/membership`,
    });
    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
