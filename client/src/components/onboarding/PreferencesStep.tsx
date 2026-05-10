// Step 4 of the seeker wizard.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import type { SeekerPreferencesData, SeekerJobType } from "@shared/schema";

const JOB_TYPES: { value: SeekerJobType; label: string }[] = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "owner_operator", label: "Owner-operator" },
];

const MODAL_OPTIONS: { value: SeekerPreferencesData["modal_preferences"][number]; label: string; comingSoon?: boolean }[] = [
  { value: "trucking", label: "Trucking" },
  { value: "maritime", label: "Maritime", comingSoon: true },
  { value: "aviation", label: "Aviation", comingSoon: true },
  { value: "logistics", label: "Logistics", comingSoon: true },
];

type Props = {
  initial?: SeekerPreferencesData;
  onSubmit: (prefs: SeekerPreferencesData) => Promise<void>;
  onBack: () => void;
  saving: boolean;
};

export function PreferencesStep({ initial, onSubmit, onBack, saving }: Props) {
  const [jobTypes, setJobTypes] = useState<Set<SeekerJobType>>(new Set(initial?.job_types ?? []));
  const [modals, setModals] = useState<Set<SeekerPreferencesData["modal_preferences"][number]>>(
    new Set(initial?.modal_preferences ?? ["trucking"]),
  );

  const toggle = <T,>(set: Set<T>, value: T) => {
    const next = new Set(set);
    next.has(value) ? next.delete(value) : next.add(value);
    return next;
  };

  const handleSubmit = async () => {
    await onSubmit({
      job_types: Array.from(jobTypes),
      modal_preferences: Array.from(modals),
    });
  };

  return (
    <Card className="p-6 space-y-6" data-testid="step-preferences">
      <div>
        <h2 className="text-xl font-bold">Your Preferences</h2>
        <p className="text-sm text-muted-foreground mt-1">
          We'll prioritize matches that fit. You can change these any time.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-sm">Job types</h3>
        <div className="grid grid-cols-2 gap-2">
          {JOB_TYPES.map((j) => (
            <label key={j.value} className="flex items-center gap-2 rounded-md border border-border p-2.5 cursor-pointer hover:bg-muted/40">
              <Checkbox
                checked={jobTypes.has(j.value)}
                onCheckedChange={() => setJobTypes((s) => toggle(s, j.value))}
                data-testid={`job-type-${j.value}`}
              />
              <span className="text-sm">{j.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-sm">Modal preferences</h3>
        <div className="grid grid-cols-2 gap-2">
          {MODAL_OPTIONS.map((m) => (
            <label
              key={m.value}
              className={`flex items-center gap-2 rounded-md border border-border p-2.5 ${
                m.comingSoon ? "opacity-60" : "cursor-pointer hover:bg-muted/40"
              }`}
            >
              <Checkbox
                checked={modals.has(m.value)}
                onCheckedChange={() => setModals((s) => toggle(s, m.value))}
                data-testid={`modal-${m.value}`}
              />
              <span className="text-sm flex-1">{m.label}</span>
              {m.comingSoon && <Badge variant="secondary" className="text-[10px]">Coming soon</Badge>}
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack} data-testid="preferences-back">← Back</Button>
        <Button onClick={handleSubmit} disabled={saving} data-testid="preferences-submit">
          {saving ? "Computing matches…" : "Find My Matches →"}
        </Button>
      </div>
    </Card>
  );
}
