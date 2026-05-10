import { Check, X } from "lucide-react";
import type { ScoreBreakdown } from "@shared/matchTypes";

type Props = {
  breakdown?: ScoreBreakdown;
  // Fallback: when we only have the list-summary, render aggregate counts.
  required?: { met: number; total: number };
  preferred?: { met: number; total: number };
};

export function RequirementPills({ breakdown, required, preferred }: Props) {
  if (breakdown) {
    const items = [
      ...breakdown.credentials_required.met.map((code) => ({ code, met: true, kind: "required" as const })),
      ...breakdown.credentials_required.missing.map((code) => ({ code, met: false, kind: "required" as const })),
      ...breakdown.credentials_preferred.met.map((code) => ({ code, met: true, kind: "preferred" as const })),
    ].slice(0, 4);
    return (
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <span
            key={`${it.kind}-${it.code}`}
            className={`inline-flex items-center gap-1 text-xs rounded-md border px-2 py-0.5 ${
              it.met
                ? "bg-green-500/5 border-green-500/30 text-green-700 dark:text-green-400"
                : "bg-red-500/5 border-red-500/30 text-red-700 dark:text-red-400"
            }`}
          >
            {it.met ? <Check size={12} /> : <X size={12} />}
            <span>{it.code}</span>
            {!it.met && it.kind === "required" && <span className="text-[10px] uppercase">req</span>}
          </span>
        ))}
      </div>
    );
  }

  // Aggregate fallback
  return (
    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
      {required && (
        <span>
          Required: <strong className="text-foreground">{required.met}/{required.total}</strong>
        </span>
      )}
      {preferred && (
        <span>
          Preferred: <strong className="text-foreground">{preferred.met}/{preferred.total}</strong>
        </span>
      )}
    </div>
  );
}
