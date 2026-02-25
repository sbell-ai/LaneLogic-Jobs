import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Zap, Shield, Star, Tag } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface PricingPlan {
  name: string;
  tier: string;
  monthlyPrice: number;
  icon: typeof Zap;
  color: string;
  description: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

const seekerPlans: PricingPlan[] = [
  {
    name: "Free",
    tier: "free",
    monthlyPrice: 0,
    icon: Shield,
    color: "text-slate-600",
    description: "Get started searching for transportation jobs.",
    features: [
      "Browse all job listings",
      "1 resume on file",
      "Apply to up to 5 jobs/month",
      "Access free resources",
      "Email job alerts",
    ],
    cta: "Get Started Free",
  },
  {
    name: "Basic",
    tier: "basic",
    monthlyPrice: 19,
    icon: Zap,
    color: "text-primary",
    description: "Stand out with advanced application tools.",
    features: [
      "Everything in Free",
      "Unlimited job applications",
      "3 resumes on file",
      "Priority application status",
      "Access basic resources",
      "Profile visibility boost",
    ],
    cta: "Start Basic Plan",
    highlighted: true,
  },
  {
    name: "Premium",
    tier: "premium",
    monthlyPrice: 49,
    icon: Star,
    color: "text-accent",
    description: "Maximum visibility and career tools.",
    features: [
      "Everything in Basic",
      "Unlimited resumes",
      "Featured profile badge",
      "All premium resources",
      "Direct employer messaging",
      "Career coaching session",
      "Dedicated job alerts",
    ],
    cta: "Start Premium Plan",
  },
];

const employerPlans: PricingPlan[] = [
  {
    name: "Free",
    tier: "free",
    monthlyPrice: 0,
    icon: Shield,
    color: "text-slate-600",
    description: "Try out the platform with basic posting.",
    features: [
      "Post up to 2 jobs/month",
      "Standard job listing",
      "View applications",
      "Basic employer profile",
    ],
    cta: "Get Started Free",
  },
  {
    name: "Basic",
    tier: "basic",
    monthlyPrice: 79,
    icon: Zap,
    color: "text-primary",
    description: "For growing transportation companies.",
    features: [
      "Post up to 10 jobs/month",
      "Featured job listings",
      "Applicant filtering",
      "Company profile page",
      "CSV bulk job upload",
      "Email support",
    ],
    cta: "Start Basic Plan",
    highlighted: true,
  },
  {
    name: "Premium",
    tier: "premium",
    monthlyPrice: 199,
    icon: Star,
    color: "text-accent",
    description: "Unlimited hiring for large fleets.",
    features: [
      "Unlimited job postings",
      "Priority job placement",
      "Advanced analytics",
      "Candidate search & filter",
      "Branded company page",
      "Dedicated account manager",
      "API access",
    ],
    cta: "Start Premium Plan",
  },
];

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

function PlanCard({ plan, onSelect, discount }: { plan: PricingPlan; onSelect: (tier: string) => void; discount: CouponDiscount | null }) {
  const Icon = plan.icon;
  const discountedPrice = calcDiscountedPrice(plan.monthlyPrice, discount);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative bg-white dark:bg-slate-900 rounded-2xl border shadow-sm flex flex-col ${
        plan.highlighted
          ? "border-primary shadow-xl shadow-primary/10 scale-[1.02]"
          : "border-border"
      }`}
    >
      {plan.highlighted && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="bg-primary text-primary-foreground text-xs font-bold px-4 py-1 rounded-full shadow">
            Most Popular
          </span>
        </div>
      )}
      <div className="p-8 border-b border-border">
        <div className={`w-12 h-12 rounded-xl bg-current/10 flex items-center justify-center mb-4 ${plan.color}`}>
          <Icon size={24} />
        </div>
        <h3 className="text-2xl font-bold font-display mb-1">{plan.name}</h3>
        <p className="text-muted-foreground text-sm mb-4">{plan.description}</p>
        <div className="flex items-baseline gap-2">
          {discountedPrice !== null ? (
            <>
              <span className="text-4xl font-bold font-display text-primary" data-testid={`text-discounted-price-${plan.tier}`}>${discountedPrice}</span>
              <span className="text-xl text-muted-foreground line-through" data-testid={`text-original-price-${plan.tier}`}>${plan.monthlyPrice}</span>
            </>
          ) : (
            <span className="text-4xl font-bold font-display">${plan.monthlyPrice}</span>
          )}
          {plan.monthlyPrice > 0 && <span className="text-muted-foreground text-sm">/month</span>}
        </div>
        {discountedPrice !== null && (
          <p className="text-xs text-primary mt-1 font-medium" data-testid={`text-discount-label-${plan.tier}`}>
            {discount!.discountType === "percent" ? `${discount!.discountValue}% off` : `$${discount!.discountValue} off`}
          </p>
        )}
      </div>
      <div className="p-8 flex flex-col flex-grow">
        <ul className="space-y-3 flex-grow mb-8">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm">
              <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
              <span className="text-muted-foreground">{f}</span>
            </li>
          ))}
        </ul>
        <Button
          className={`w-full hover-elevate ${plan.highlighted ? "bg-primary shadow-lg shadow-primary/25" : ""}`}
          variant={plan.highlighted ? "default" : "outline"}
          onClick={() => onSelect(plan.tier)}
          data-testid={`button-select-plan-${plan.tier}`}
        >
          {plan.cta}
        </Button>
      </div>
    </motion.div>
  );
}

export default function Pricing() {
  const [tab, setTab] = useState<"seeker" | "employer">("seeker");
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState<CouponDiscount | null>(null);
  const [couponError, setCouponError] = useState("");

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
    const activePlans = tab === "seeker" ? seekerPlans : employerPlans;
    const paidTier = activePlans.find((p) => p.highlighted)?.tier || "basic";
    couponMutation.mutate({ code: couponCode.trim(), tier: paidTier });
  };

  const upgradeMutation = useMutation({
    mutationFn: async (tier: string) => {
      const res = await fetch("/api/payments/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tier }),
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

  const handleSelect = (tier: string) => {
    if (!user) {
      setLocation("/register");
      return;
    }
    if (tier === "free") {
      toast({ title: "You're on the free plan!", description: "No payment required." });
      return;
    }
    upgradeMutation.mutate(tier);
  };

  const plans = tab === "seeker" ? seekerPlans : employerPlans;

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

          <div className="inline-flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
            <button
              data-testid="tab-job-seekers"
              onClick={() => setTab("seeker")}
              className={`px-5 py-2 rounded-lg font-semibold text-sm transition-all ${
                tab === "seeker"
                  ? "bg-white dark:bg-slate-900 text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Job Seekers
            </button>
            <button
              data-testid="tab-employers"
              onClick={() => setTab("employer")}
              className={`px-5 py-2 rounded-lg font-semibold text-sm transition-all ${
                tab === "employer"
                  ? "bg-white dark:bg-slate-900 text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Employers
            </button>
          </div>
        </div>

        <div className="container mx-auto px-4 md:px-6 py-16">
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
            {plans.map((plan) => (
              <PlanCard key={plan.tier} plan={plan} onSelect={handleSelect} discount={couponDiscount} />
            ))}
          </div>

          <div className="mt-16 text-center">
            <h2 className="text-2xl font-bold font-display mb-3">Need a custom plan?</h2>
            <p className="text-muted-foreground mb-6">
              We offer custom enterprise pricing for large fleets and staffing agencies.
            </p>
            <Button variant="outline" size="lg" asChild>
              <Link href="mailto:sales@transpojobs.com">Contact Sales</Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
