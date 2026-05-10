import type { ScoreTier } from "@shared/matchTypes";

const TIER_STYLES: Record<ScoreTier, { wrap: string; label: string }> = {
  strong:       { wrap: "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400",   label: "STRONG" },
  good:         { wrap: "bg-teal-500/10 border-teal-500/30 text-teal-700 dark:text-teal-400",       label: "GOOD" },
  partial:      { wrap: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400",   label: "PARTIAL" },
  low:          { wrap: "bg-slate-500/10 border-slate-500/30 text-slate-700 dark:text-slate-400",   label: "LOW" },
  disqualified: { wrap: "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400",           label: "DISQUALIFIED" },
};

type Props = {
  tier: ScoreTier;
  score: number;
};

export function ScoreBadge({ tier, score }: Props) {
  const styles = TIER_STYLES[tier];
  return (
    <div
      className={`flex flex-col items-center justify-center min-w-[88px] rounded-lg border px-3 py-2 ${styles.wrap}`}
      data-testid={`score-badge-${tier}`}
    >
      <span className="text-2xl font-bold leading-none">{score}%</span>
      <span className="mt-1 text-[10px] font-bold tracking-wider">{styles.label}</span>
    </div>
  );
}
