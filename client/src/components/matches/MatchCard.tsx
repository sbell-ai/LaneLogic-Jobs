import { useState } from "react";
import { Link } from "wouter";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { MatchScore } from "@shared/matchTypes";
import { ScoreBadge } from "./ScoreBadge";
import { RequirementPills } from "./RequirementPills";
import { MatchBreakdownPanel } from "./MatchBreakdownPanel";
import { useMatchDetail } from "@/hooks/useMatchDetail";

type Props = {
  match: MatchScore;
};

export function MatchCard({ match }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { data: detail, isLoading } = useMatchDetail(match.job_id, expanded);

  const required = { met: match.summary.required_met, total: match.summary.required_total };
  const preferred = { met: match.summary.preferred_met, total: match.summary.preferred_total };

  return (
    <Card className="overflow-hidden" data-testid={`match-card-${match.job_id}`}>
      <div className="p-5 flex items-start gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <Link
              href={`/jobs/${match.job_id}`}
              className="font-semibold text-base hover:underline"
              data-testid={`match-job-title-${match.job_id}`}
            >
              {match.job.title}
            </Link>
            <p className="text-sm text-muted-foreground">
              {[match.job.employer_name, match.job.location].filter(Boolean).join(" · ")}
            </p>
            {match.job.job_type && (
              <p className="text-xs text-muted-foreground mt-0.5">{match.job.job_type}</p>
            )}
          </div>

          <RequirementPills required={required} preferred={preferred} />
        </div>

        <ScoreBadge tier={match.tier} score={match.score} />
      </div>

      <div className="px-5 pb-4 flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((v) => !v)}
          className="gap-1.5"
          data-testid={`toggle-breakdown-${match.job_id}`}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? "Hide breakdown" : "View Full Breakdown"}
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={`/jobs/${match.job_id}`} data-testid={`view-job-${match.job_id}`}>
            View job
          </Link>
        </Button>
      </div>

      {expanded && <MatchBreakdownPanel detail={detail} isLoading={isLoading} />}
    </Card>
  );
}
