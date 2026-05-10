import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Lightbulb, X } from "lucide-react";
import type { CredentialGap } from "@shared/matchTypes";

const DISMISS_KEY = "ll_completion_prompt_dismissed";

type Props = {
  gap: CredentialGap | null;
};

export function CompletionPromptBanner({ gap }: Props) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(typeof window !== "undefined" && sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  // Per-spec: show only when the same gap appears in 3+ matched jobs.
  if (!gap || gap.affected_job_count < 3 || dismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div
      className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex items-center gap-3"
      data-testid="completion-prompt"
    >
      <Lightbulb size={20} className="text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          Add <span className="font-semibold">{gap.name}</span> to improve {gap.affected_job_count} matched jobs
        </p>
        <Link
          href="/seeker/settings/cert-profile"
          className="text-xs text-primary hover:underline"
          data-testid="completion-prompt-cta"
        >
          Complete Your Profile →
        </Link>
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 rounded-md p-1 hover:bg-primary/10 text-muted-foreground"
        aria-label="Dismiss"
        data-testid="completion-prompt-dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
