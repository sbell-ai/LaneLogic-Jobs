type Props = {
  current: number; // 1-indexed
  total: number;
  labels?: string[];
};

export function StepIndicator({ current, total, labels }: Props) {
  const pct = Math.round(((current - 1) / Math.max(1, total - 1)) * 100);
  return (
    <div className="space-y-2 mb-6">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span data-testid="step-label">
          Step {current} of {total}
          {labels && labels[current - 1] && <span> · {labels[current - 1]}</span>}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
