import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Zap, Shield, Star, Tag, Loader2, Infinity } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

type PricingFeature = {
  key: string;
  name: string;
  value: number;
  isUnlimited: boolean;
  enabled: boolean;
  type: string;
};

type PricingProduct = {
  name: string;
  audience: string;
  billingCycle: string;
  planType: string;
  price: number;
  trialDays: number;
  stripePriceId: string;
  logicKey: string;
  features: PricingFeature[];
};

type PricingData = {
  products: PricingProduct[];
  audiences: string[];
};

interface CouponDiscount {
  discountType: "percent" | "fixed";
  discountValue: number;
}

function calcDiscountedPrice(price: number, discount: CouponDiscount | null): number | null {
  if (!discount || price === 0) return null;
  if (discount.discountType === "percent") {
    return Math.max(0, Math.round(price * (1 - discount.discountValue / 100) * 100) / 100);
  }
  return Math.max(0, price - discount.discountValue);
}

function formatFeature(f: PricingFeature): string {
  if (f.type === "Flag") {
    return f.enabled ? f.name : "";
  }
  if (f.isUnlimited) return `Unlimited ${f.name.toLowerCase()}`;
  if (f.value > 0) return `${f.value} ${f.name.toLowerCase()}`;
  return "";
}

function getProductIcon(logicKey: string) {
  if (logicKey?.toLowerCase().includes("enterprise") || logicKey?.toLowerCase().includes("premium")) return Star;
  if (logicKey?.toLowerCase().includes("professional") || logicKey?.toLowerCase().includes("basic")) return Zap;
  return Shield;
}

function getProductColor(logicKey: string) {
  if (logicKey?.toLowerCase().includes("enterprise") || logicKey?.toLowerCase().includes("premium")) return "text-accent";
  if (logicKey?.toLowerCase().includes("professional") || logicKey?.toLowerCase().includes("basic")) return "text-primary";
  return "text-slate-600";
}

function isHighlighted(logicKey: string) {
  return logicKey?.toLowerCase().includes("professional");
}

function PlanCard({
  product,
  onSelect,
  discount,
  cycle,
}: {
  product: PricingProduct;
  onSelect: (product: PricingProduct) => void;
  discount: CouponDiscount | null;
  cycle: string;
}) {
  const Icon = getProductIcon(product.logicKey);
  const color = getProductColor(product.logicKey);
  const highlighted = isHighlighted(product.logicKey);
  const isFree = product.price === 0 && !product.stripePriceId;
  const isTopUp = product.planType === "Top-up";
  const discountedPrice = calcDiscountedPrice(product.price, discount);

  const featureLines = product.features
    .map(formatFeature)
    .filter(Boolean);

  const priceLabel = cycle === "Yearly"
    ? `/year`
    : isTopUp ? " one-time" : "/month";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative bg-white dark:bg-slate-900 rounded-2xl border shadow-sm flex flex-col ${
        highlighted
          ? "border-primary shadow-xl shadow-primary/10 scale-[1.02]"
          : "border-border"
      }`}
      data-testid={`card-plan-${product.logicKey || product.name}`}
    >
      {highlighted && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="bg-primary text-primary-foreground text-xs font-bold px-4 py-1 rounded-full shadow">
            Most Popular
          </span>
        </div>
      )}
      <div className="p-8 border-b border-border">
        <div className={`w-12 h-12 rounded-xl bg-current/10 flex items-center justify-center mb-4 ${color}`}>
          <Icon size={24} />
        </div>
        <h3 className="text-2xl font-bold font-display mb-1" data-testid={`text-plan-name-${product.logicKey}`}>{product.name}</h3>
        {product.trialDays > 0 && (
          <p className="text-xs text-primary font-medium mb-2" data-testid={`text-trial-${product.logicKey}`}>
            {product.trialDays}-day free trial
          </p>
        )}
        <div className="flex items-baseline gap-2">
          {discountedPrice !== null ? (
            <>
              <span className="text-4xl font-bold font-display text-primary" data-testid={`text-discounted-price-${product.logicKey}`}>
                ${discountedPrice}
              </span>
              <span className="text-xl text-muted-foreground line-through" data-testid={`text-original-price-${product.logicKey}`}>
                ${product.price}
              </span>
            </>
          ) : (
            <span className="text-4xl font-bold font-display" data-testid={`text-price-${product.logicKey}`}>
              {isFree ? "Free" : `$${product.price}`}
            </span>
          )}
          {product.price > 0 && (
            <span className="text-muted-foreground text-sm">{priceLabel}</span>
          )}
        </div>
        {discountedPrice !== null && (
          <p className="text-xs text-primary mt-1 font-medium" data-testid={`text-discount-label-${product.logicKey}`}>
            {discount!.discountType === "percent" ? `${discount!.discountValue}% off` : `$${discount!.discountValue} off`}
          </p>
        )}
      </div>
      <div className="p-8 flex flex-col flex-grow">
        <ul className="space-y-3 flex-grow mb-8">
          {featureLines.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm">
              <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
              <span className="text-muted-foreground">{f}</span>
            </li>
          ))}
        </ul>
        {isFree ? (
          <Button
            className="w-full"
            variant="outline"
            onClick={() => onSelect(product)}
            data-testid={`button-select-plan-${product.logicKey}`}
          >
            Get Started Free
          </Button>
        ) : (
          <Button
            className={`w-full hover-elevate ${highlighted ? "bg-primary shadow-lg shadow-primary/25" : ""}`}
            variant={highlighted ? "default" : "outline"}
            onClick={() => onSelect(product)}
            data-testid={`button-select-plan-${product.logicKey}`}
          >
            {isTopUp ? "Purchase" : "Subscribe"}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

export default function Pricing() {
  const [tab, setTab] = useState<string>("Job Seeker");
  const [cycle, setCycle] = useState<"Monthly" | "Yearly">("Monthly");
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState<CouponDiscount | null>(null);
  const [couponError, setCouponError] = useState("");

  const { data: pricingData, isLoading, error } = useQuery<PricingData>({
    queryKey: ["/api/registry/pricing"],
  });

  const couponMutation = useMutation({
    mutationFn: async ({ code, tier }: { code: string; tier: string }) => {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code, tier }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Invalid coupon code");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setCouponDiscount({ discountType: data.discountType, discountValue: data.discountValue });
      setCouponError("");
      toast({ title: "Coupon applied!", description: `${data.discountType === "percent" ? `${data.discountValue}%` : `$${data.discountValue}`} discount applied.` });
    },
    onError: (err: Error) => {
      setCouponDiscount(null);
      setCouponError(err.message);
      toast({ title: "Invalid coupon", description: err.message, variant: "destructive" });
    },
  });

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) return;
    setCouponError("");
    couponMutation.mutate({ code: couponCode.trim(), tier: "basic" });
  };

  const upgradeMutation = useMutation({
    mutationFn: async (product: PricingProduct) => {
      const res = await fetch("/api/payments/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          stripePriceId: product.stripePriceId,
          planType: product.planType,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to start checkout");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Plan selected!", description: "Your membership has been updated." });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSelect = (product: PricingProduct) => {
    if (!user) {
      setLocation("/register");
      return;
    }
    if (!product.stripePriceId) {
      toast({ title: "You're on the free plan!", description: "No payment required." });
      return;
    }
    upgradeMutation.mutate(product);
  };

  const audiences = pricingData?.audiences ?? [];
  const currentTab = audiences.includes(tab) ? tab : audiences[0] ?? "Job Seeker";

  const allForAudience = (pricingData?.products ?? []).filter((p) => p.audience === currentTab);

  const seenFreeNames = new Set<string>();
  const filteredProducts = allForAudience.filter((p) => {
    if (p.planType === "Top-up") return true;
    const isFree = !p.stripePriceId && p.price === 0;
    if (isFree) {
      if (seenFreeNames.has(p.name)) return false;
      seenFreeNames.add(p.name);
      return true;
    }
    return p.billingCycle === cycle;
  });

  const subscriptions = filteredProducts.filter((p) => p.planType !== "Top-up");
  const topUps = filteredProducts.filter((p) => p.planType === "Top-up");

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />
      <main className="flex-grow bg-slate-50 dark:bg-slate-950">
        <div className="bg-white dark:bg-slate-900 border-b border-border py-14 text-center">
          <span className="inline-block py-1 px-3 rounded-full bg-primary/10 text-primary font-semibold text-sm mb-4 border border-primary/20">
            Simple, Transparent Pricing
          </span>
          <h1 className="text-4xl md:text-5xl font-bold font-display mb-4">Choose Your Plan</h1>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8">
            Whether you're finding your next driving job or building your fleet — we have a plan to get you there.
          </p>

          <div className="flex flex-col items-center gap-4">
            <div className="inline-flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
              {audiences.map((aud) => (
                <button
                  key={aud}
                  data-testid={`tab-${aud.toLowerCase().replace(/\s+/g, "-")}`}
                  onClick={() => setTab(aud)}
                  className={`px-5 py-2 rounded-lg font-semibold text-sm transition-all ${
                    currentTab === aud
                      ? "bg-white dark:bg-slate-900 text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {aud === "Job Seeker" ? "Job Seekers" : `${aud}s`}
                </button>
              ))}
            </div>

            <div className="inline-flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
              <button
                data-testid="toggle-monthly"
                onClick={() => setCycle("Monthly")}
                className={`px-4 py-1.5 rounded-lg font-medium text-sm transition-all ${
                  cycle === "Monthly"
                    ? "bg-white dark:bg-slate-900 text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Monthly
              </button>
              <button
                data-testid="toggle-yearly"
                onClick={() => setCycle("Yearly")}
                className={`px-4 py-1.5 rounded-lg font-medium text-sm transition-all ${
                  cycle === "Yearly"
                    ? "bg-white dark:bg-slate-900 text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Yearly
              </button>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 md:px-6 py-16">
          {isLoading && (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {error && (
            <div className="text-center py-20 text-muted-foreground">
              <p>Pricing data is loading. Please try again in a moment.</p>
            </div>
          )}

          {!isLoading && !error && (
            <>
              <div className="max-w-md mx-auto mb-10">
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-border p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag size={16} className="text-muted-foreground" />
                    <span className="text-sm font-semibold">Have a coupon code?</span>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      data-testid="input-coupon-code"
                      placeholder="Enter coupon code"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                    />
                    <Button
                      data-testid="button-apply-coupon"
                      variant="outline"
                      onClick={handleApplyCoupon}
                      disabled={couponMutation.isPending || !couponCode.trim()}
                    >
                      {couponMutation.isPending ? "Checking..." : "Apply"}
                    </Button>
                  </div>
                  {couponError && (
                    <p className="text-xs text-destructive mt-2" data-testid="text-coupon-error">{couponError}</p>
                  )}
                  {couponDiscount && (
                    <p className="text-xs text-primary mt-2 font-medium" data-testid="text-coupon-success">
                      {couponDiscount.discountType === "percent" ? `${couponDiscount.discountValue}%` : `$${couponDiscount.discountValue}`} discount applied
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto items-start">
                {subscriptions.map((product) => (
                  <PlanCard
                    key={`${product.stripePriceId || product.name}-${product.billingCycle}`}
                    product={product}
                    onSelect={handleSelect}
                    discount={couponDiscount}
                    cycle={cycle}
                  />
                ))}
              </div>

              {topUps.length > 0 && (
                <div className="mt-16 max-w-5xl mx-auto">
                  <h2 className="text-2xl font-bold font-display mb-6 text-center">Add-Ons</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                    {topUps.map((product) => (
                      <PlanCard
                        key={product.stripePriceId || product.name}
                        product={product}
                        onSelect={handleSelect}
                        discount={couponDiscount}
                        cycle={cycle}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-4" data-testid="text-credit-expiry-disclosure">
                    Credits expire 12 months from purchase date. Unused credits are non-refundable.
                  </p>
                </div>
              )}
            </>
          )}

          <div className="mt-16 text-center">
            <h2 className="text-2xl font-bold font-display mb-3">Need a custom plan?</h2>
            <p className="text-muted-foreground mb-6">
              We offer custom enterprise pricing for large fleets and staffing agencies.
            </p>
            <Button variant="outline" size="lg" asChild>
              <Link href="mailto:sales@lanelogicjobs.com">Contact Sales</Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
