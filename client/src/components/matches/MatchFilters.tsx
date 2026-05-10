import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { MatchListFilters } from "@/hooks/useMatches";

type Props = {
  filters: MatchListFilters;
  onChange: (next: MatchListFilters) => void;
};

const SORT_OPTIONS: { value: NonNullable<MatchListFilters["sort"]>; label: string }[] = [
  { value: "score", label: "Score" },
  { value: "experience", label: "Experience" },
  { value: "location", label: "Location" },
];

const MIN_SCORE_OPTIONS: { value: string; label: string }[] = [
  { value: "0", label: "All Scores" },
  { value: "45", label: "45+ (Partial)" },
  { value: "65", label: "65+ (Good)" },
  { value: "85", label: "85+ (Strong)" },
];

export function MatchFilters({ filters, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-4 px-1">
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">Sort:</label>
        <Select
          value={filters.sort ?? "score"}
          onValueChange={(v) => onChange({ ...filters, sort: v as MatchListFilters["sort"], page: 1 })}
        >
          <SelectTrigger className="w-36" data-testid="filter-sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">Filter:</label>
        <Select
          value={String(filters.minScore ?? 0)}
          onValueChange={(v) => onChange({ ...filters, minScore: parseInt(v, 10) || undefined, page: 1 })}
        >
          <SelectTrigger className="w-44" data-testid="filter-min-score">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MIN_SCORE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox
          checked={!!filters.hideDisqualified}
          onCheckedChange={(v) => onChange({ ...filters, hideDisqualified: !!v, page: 1 })}
          data-testid="filter-hide-disqualified"
        />
        <span>Hide Disqualified</span>
      </label>
    </div>
  );
}
