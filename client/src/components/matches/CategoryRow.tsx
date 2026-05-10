type Props = {
  label: string;
  score: number;
  max: number;
  children?: React.ReactNode;
};

export function CategoryRow({ label, score, max, children }: Props) {
  return (
    <div className="space-y-2 py-3 border-b border-border last:border-b-0">
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold text-sm">{label}</h3>
        <span className="text-sm tabular-nums text-muted-foreground">
          <strong className="text-foreground">{score}</strong> / {max} pts
        </span>
      </div>
      {children && <div className="space-y-1.5 text-sm">{children}</div>}
    </div>
  );
}
