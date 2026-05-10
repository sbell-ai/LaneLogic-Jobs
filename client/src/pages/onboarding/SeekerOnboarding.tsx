// Seeker wizard. Orchestrates 4 steps with localStorage step persistence so a
// closed tab doesn't lose progress. Each step PATCHes its slice
// independently — there's no all-or-nothing payload at the end.

import { useEffect, useMemo, useState } from "react";
import { Redirect, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { StepIndicator } from "@/components/onboarding/StepIndicator";
import { WelcomeStep } from "@/components/onboarding/WelcomeStep";
import { CredentialsStep } from "@/components/onboarding/CredentialsStep";
import { ExperienceLocationStep } from "@/components/onboarding/ExperienceLocationStep";
import { PreferencesStep } from "@/components/onboarding/PreferencesStep";
import type { CredentialType, SeekerPreferencesData } from "@shared/schema";

const STORAGE_KEY = "ll_onboarding_step";
const STEP_LABELS = ["Welcome", "Credentials", "Experience & Location", "Preferences"];

function readStoredStep(): number {
  if (typeof window === "undefined") return 1;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const n = raw ? parseInt(raw, 10) : 1;
  return Number.isFinite(n) && n >= 1 && n <= 4 ? n : 1;
}

export default function SeekerOnboardingPage() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState<number>(() => readStoredStep());
  const [saving, setSaving] = useState(false);
  const [credentials, setCredentials] = useState<CredentialType[]>([]);
  const [preferences, setPreferences] = useState<SeekerPreferencesData | undefined>();

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, String(step));
  }, [step]);

  const onboardingDone = useMemo(() => !!(user as any)?.onboardingCompletedAt, [user]);

  if (isLoading) return <OnboardingShell><p className="text-sm text-muted-foreground">Loading…</p></OnboardingShell>;
  if (!user) return <Redirect to="/" />;
  if (user.role !== "job_seeker") return <Redirect to="/" />;
  if (onboardingDone) return <Redirect to="/matches" />;

  const goNext = () => setStep((s) => Math.min(4, s + 1));
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const saveCredentials = async (selected: CredentialType[]) => {
    setSaving(true);
    try {
      await apiRequest("PATCH", "/api/onboarding/seeker/credentials", {
        codes: selected.map((c) => c.code),
      });
      setCredentials(selected);
      goNext();
    } catch (err) {
      toast({ title: "Save failed", description: "Could not save credentials.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const skipCredentials = async () => {
    // Persist empty so a refreshed wizard reflects the skip.
    setSaving(true);
    try {
      await apiRequest("PATCH", "/api/onboarding/seeker/credentials", { codes: [] });
      goNext();
    } catch {
      // skip is best-effort
      goNext();
    } finally {
      setSaving(false);
    }
  };

  const saveExperience = async (values: { yearsExperience: number | null; lat: number | null; lng: number | null }) => {
    setSaving(true);
    try {
      await apiRequest("PATCH", "/api/onboarding/seeker/experience", {
        years_experience: values.yearsExperience,
        lat: values.lat,
        lng: values.lng,
      });
      goNext();
    } catch {
      toast({ title: "Save failed", description: "Could not save experience.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const submitPreferences = async (prefs: SeekerPreferencesData) => {
    setSaving(true);
    try {
      await apiRequest("PATCH", "/api/onboarding/seeker/preferences", prefs);
      setPreferences(prefs);
      // Complete + recompute matches in one round trip.
      await apiRequest("POST", "/api/onboarding/seeker/complete", {});
      // Clear local step state so a future onboarding (shouldn't happen) starts clean.
      if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
      // Auth payload now has onboardingCompletedAt; refetch.
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      navigate("/matches");
    } catch {
      toast({ title: "Save failed", description: "Could not finish setup.", variant: "destructive" });
      setSaving(false);
    }
  };

  return (
    <OnboardingShell>
      <StepIndicator current={step} total={4} labels={STEP_LABELS} />

      {step === 1 && (
        <WelcomeStep
          headline="Let's build your profile"
          valueProp="We'll match you to jobs based on your actual credentials — not just keywords."
          onContinue={goNext}
        />
      )}

      {step === 2 && (
        <CredentialsStep
          initial={credentials}
          onSave={saveCredentials}
          onSkip={skipCredentials}
          saving={saving}
        />
      )}

      {step === 3 && (
        <ExperienceLocationStep
          onSave={saveExperience}
          onBack={goBack}
          saving={saving}
        />
      )}

      {step === 4 && (
        <PreferencesStep
          initial={preferences}
          onSubmit={submitPreferences}
          onBack={goBack}
          saving={saving}
        />
      )}
    </OnboardingShell>
  );
}
