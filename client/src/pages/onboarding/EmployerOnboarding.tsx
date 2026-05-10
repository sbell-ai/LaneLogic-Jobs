import { useEffect, useMemo, useState } from "react";
import { Redirect, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { StepIndicator } from "@/components/onboarding/StepIndicator";
import { WelcomeStep } from "@/components/onboarding/WelcomeStep";
import { CompanyDetailsStep, type CompanyDetailsValues } from "@/components/onboarding/CompanyDetailsStep";
import { PostJobStep } from "@/components/onboarding/PostJobStep";

const STORAGE_KEY = "ll_onboarding_step";
const STEP_LABELS = ["Welcome", "Company details", "First job"];

function readStoredStep(): number {
  if (typeof window === "undefined") return 1;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const n = raw ? parseInt(raw, 10) : 1;
  return Number.isFinite(n) && n >= 1 && n <= 3 ? n : 1;
}

export default function EmployerOnboardingPage() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState<number>(() => readStoredStep());
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState<CompanyDetailsValues | undefined>();

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, String(step));
  }, [step]);

  const onboardingDone = useMemo(() => !!(user as any)?.onboardingCompletedAt, [user]);

  if (isLoading) return <OnboardingShell><p className="text-sm text-muted-foreground">Loading…</p></OnboardingShell>;
  if (!user) return <Redirect to="/" />;
  if (user.role !== "employer") return <Redirect to="/" />;
  if (onboardingDone) return <Redirect to="/dashboard" />;

  const goNext = () => setStep((s) => Math.min(3, s + 1));
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const saveCompany = async (v: CompanyDetailsValues) => {
    setSaving(true);
    try {
      await apiRequest("PATCH", "/api/onboarding/employer/company", {
        company_name: v.companyName,
        dot_number: v.dotNumber,
        mc_number: v.mcNumber,
        primary_modal: v.primaryModal,
        lat: v.lat,
        lng: v.lng,
      });
      setDetails(v);
      goNext();
    } catch {
      toast({ title: "Save failed", description: "Could not save company details.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const completeAndGo = async (destination: "/dashboard/jobs/new" | "/dashboard") => {
    setSaving(true);
    try {
      await apiRequest("POST", "/api/onboarding/employer/complete", {});
      if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      navigate(destination);
    } catch {
      toast({ title: "Save failed", description: "Could not finish setup.", variant: "destructive" });
      setSaving(false);
    }
  };

  return (
    <OnboardingShell>
      <StepIndicator current={step} total={3} labels={STEP_LABELS} />

      {step === 1 && (
        <WelcomeStep
          headline="Let's set up your company profile"
          valueProp="Post jobs and get matched to credentialed candidates automatically."
          onContinue={goNext}
        />
      )}

      {step === 2 && (
        <CompanyDetailsStep
          initial={details}
          onSave={saveCompany}
          onBack={goBack}
          saving={saving}
        />
      )}

      {step === 3 && (
        <PostJobStep
          onPostNow={() => completeAndGo("/dashboard/jobs/new")}
          onLater={() => completeAndGo("/dashboard")}
          finishing={saving}
        />
      )}
    </OnboardingShell>
  );
}
