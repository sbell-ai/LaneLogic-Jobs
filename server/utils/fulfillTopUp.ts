import { storage } from "../storage";

export type FulfillTopUpResult =
  | { fulfilled: true; type: "credit_grant"; credits: number; expiresAt: string }
  | { fulfilled: true; type: "resume_access"; expiresAt: string }
  | { fulfilled: true; type: "featured_employer"; expiresAt: string }
  | { fulfilled: true; type: "already_fulfilled" }
  | { fulfilled: false; reason: string };

export async function fulfillTopUpFromSession(session: {
  payment_status: string;
  payment_intent: string | null;
  metadata: Record<string, string> | null;
}): Promise<FulfillTopUpResult> {
  if (session.payment_status !== "paid") {
    return { fulfilled: false, reason: "Payment not completed" };
  }

  const userId = parseInt(session.metadata?.userId || "0", 10);
  if (!userId) {
    return { fulfilled: false, reason: "Missing userId in metadata" };
  }

  const planType = session.metadata?.planType;
  if (planType !== "Top-up") {
    return { fulfilled: false, reason: "Not a top-up purchase" };
  }

  const paidPriceId = session.metadata?.stripePriceId;
  if (!paidPriceId) {
    return { fulfilled: false, reason: "Missing stripePriceId in metadata" };
  }

  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;

  if (paymentIntentId) {
    const existingGrant = await storage.getCreditGrantByPaymentIntent(paymentIntentId);
    if (existingGrant) {
      return { fulfilled: true, type: "already_fulfilled" };
    }
  }

  const now = new Date();
  const user = await storage.getUser(userId);
  if (!user) {
    return { fulfilled: false, reason: "User not found" };
  }

  const dbProduct = (await storage.getAdminProducts()).find(
    (p) => p.stripePriceIdMonthly === paidPriceId || p.stripePriceIdYearly === paidPriceId || p.stripePriceIdOneTime === paidPriceId
  );

  if (dbProduct && dbProduct.grantEntitlementKey && dbProduct.grantAmount) {
    const expiryMonths = dbProduct.creditExpiryMonths || 12;
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + expiryMonths);

    await storage.createCreditGrant({
      userId,
      entitlementKey: dbProduct.grantEntitlementKey,
      amountGranted: dbProduct.grantAmount,
      amountRemaining: dbProduct.grantAmount,
      grantedAt: now,
      expiresAt,
      stripePaymentIntentId: paymentIntentId,
      status: "Active",
    });

    return {
      fulfilled: true,
      type: "credit_grant",
      credits: dbProduct.grantAmount,
      expiresAt: expiresAt.toISOString(),
    };
  }

  const productName = dbProduct?.name?.toLowerCase() || "";

  if (productName.includes("resume")) {
    const currentExpiry = (user as any).resumeAccessExpiresAt ? new Date((user as any).resumeAccessExpiresAt) : null;
    const baseDate = currentExpiry && currentExpiry > now ? currentExpiry : now;
    const newExpiry = new Date(baseDate.getTime() + 365 * 24 * 60 * 60 * 1000);
    await storage.updateUser(userId, { resumeAccessExpiresAt: newExpiry } as any);
    return { fulfilled: true, type: "resume_access", expiresAt: newExpiry.toISOString() };
  }

  if (productName.includes("featured")) {
    const currentExpiry = (user as any).featuredEmployerExpiresAt ? new Date((user as any).featuredEmployerExpiresAt) : null;
    const baseDate = currentExpiry && currentExpiry > now ? currentExpiry : now;
    const newExpiry = new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    await storage.updateUser(userId, { featuredEmployerExpiresAt: newExpiry } as any);
    return { fulfilled: true, type: "featured_employer", expiresAt: newExpiry.toISOString() };
  }

  return { fulfilled: false, reason: "Unknown add-on type" };
}
