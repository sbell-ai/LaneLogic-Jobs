import type { MatchDetail } from "@shared/matchTypes";
import { CategoryRow } from "./CategoryRow";
import { CredentialGapRow } from "./CredentialGapRow";

type Props = {
  detail: MatchDetail | undefined;
  isLoading: boolean;
};

export function MatchBreakdownPanel({ detail, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="border-t border-border bg-muted/30 px-5 py-4 text-sm text-muted-foreground">
        Loading breakdown…
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="border-t border-border bg-muted/30 px-5 py-4 text-sm text-muted-foreground">
        Could not load breakdown.
      </div>
    );
  }

  const { score_breakdown: bd, gaps } = detail;
  const gapByCode = new Map(gaps.map((g) => [g.code, g]));

  return (
    <div className="border-t border-border bg-muted/30 px-5 py-4 space-y-1" data-testid="match-breakdown">
      <CategoryRow
        label="Required Credentials"
        score={bd.credentials_required.score}
        max={bd.credentials_required.max}
      >
        {bd.credentials_required.met.map((code) => (
          <CredentialGapRow
            key={`req-met-${code}`}
            code={code}
            name={gapByCode.get(code)?.name ?? code}
            met
            level="required"
          />
        ))}
        {bd.credentials_required.missing.map((code) => (
          <CredentialGapRow
            key={`req-miss-${code}`}
            code={code}
            name={gapByCode.get(code)?.name ?? code}
            met={false}
            level="required"
            showAddCta
          />
        ))}
      </CategoryRow>

      <CategoryRow
        label="Preferred Credentials"
        score={bd.credentials_preferred.score}
        max={bd.credentials_preferred.max}
      >
        {bd.credentials_preferred.met.map((code) => (
          <CredentialGapRow
            key={`pref-met-${code}`}
            code={code}
            name={gapByCode.get(code)?.name ?? code}
            met
            level="preferred"
          />
        ))}
        {bd.credentials_preferred.missing.map((code) => (
          <CredentialGapRow
            key={`pref-miss-${code}`}
            code={code}
            name={gapByCode.get(code)?.name ?? code}
            met={false}
            level="preferred"
            showAddCta
          />
        ))}
      </CategoryRow>

      <CategoryRow label="Experience" score={bd.experience.score} max={bd.experience.max}>
        <p>
          {bd.experience.seeker_years} yrs · Required: {bd.experience.required_years} yrs
        </p>
      </CategoryRow>

      <CategoryRow label="Location" score={bd.location.score} max={bd.location.max}>
        <p>
          {bd.location.remote
            ? "Remote position"
            : bd.location.distance_miles != null
            ? `~${bd.location.distance_miles} miles from posting`
            : "Distance unknown — add a home location to your profile"}
        </p>
      </CategoryRow>

      <div className="pt-3 mt-2 border-t border-border space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Current score</span>
          <span className="tabular-nums font-semibold">{detail.score} / 100</span>
        </div>
        {detail.projected_score > detail.score && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Projected score</span>
            <span className="tabular-nums font-semibold text-primary">
              {detail.projected_score} / 100
              {gaps.length > 0 && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  (if {gaps.length} credential{gaps.length === 1 ? "" : "s"} added)
                </span>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
