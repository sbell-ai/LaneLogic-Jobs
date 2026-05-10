import { useState } from "react";
import { Link, Redirect } from "wouter";
import { DashboardLayout } from "../dashboard/DashboardLayout";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RefreshCw, Sparkles } from "lucide-react";
import { useMatches, useRecomputeMatches, type MatchListFilters } from "@/hooks/useMatches";
import { MatchCard } from "@/components/matches/MatchCard";
import { MatchFilters } from "@/components/matches/MatchFilters";
import { CompletionPromptBanner } from "@/components/matches/CompletionPromptBanner";
import { MatchListPagination } from "@/components/matches/MatchListPagination";

export default function MatchesPage() {
  const { user } = useAuth();

  if (!user) return <Redirect to="/" />;
  if (user.role !== "job_seeker") return <Redirect to="/" />;

  const [filters, setFilters] = useState<MatchListFilters>({
    sort: "score",
    order: "desc",
    page: 1,
    limit: 20,
  });

  const { data, isLoading, refetch, isFetching } = useMatches(filters);
  const recompute = useRecomputeMatches();

  const matches = data?.matches ?? [];
  const total = data?.total ?? 0;
  const topGap = data?.top_gap ?? null;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Sparkles className="text-primary" size={28} />
            <div>
              <h1 className="text-2xl font-bold">My Matches</h1>
              <p className="text-sm text-muted-foreground">
                Jobs scored against your profile. Add credentials to climb the list.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => recompute.mutate(undefined, { onSuccess: () => refetch() })}
            disabled={recompute.isPending || isFetching}
            className="gap-2"
            data-testid="recompute-matches"
          >
            <RefreshCw size={14} className={recompute.isPending ? "animate-spin" : ""} />
            {recompute.isPending ? "Computing…" : "Recompute"}
          </Button>
        </div>

        {/* Filters */}
        <MatchFilters
          filters={filters}
          onChange={(next) => setFilters({ ...next, page: 1 })}
        />

        {/* Completion prompt */}
        <CompletionPromptBanner gap={topGap} />

        {/* List */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading matches…</p>
        ) : matches.length === 0 ? (
          <EmptyState onRecompute={() => recompute.mutate(undefined, { onSuccess: () => refetch() })} />
        ) : (
          <div className="space-y-3">
            {matches.map((m) => (
              <MatchCard key={m.job_id} match={m} />
            ))}
            <MatchListPagination
              page={filters.page ?? 1}
              limit={filters.limit ?? 20}
              total={total}
              onChange={(page) => setFilters({ ...filters, page })}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function EmptyState({ onRecompute }: { onRecompute: () => void }) {
  return (
    <Card className="p-8 text-center space-y-4">
      <div>
        <h2 className="font-semibold text-lg">No matches yet</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your matches will appear here once your profile includes at least one credential.
        </p>
      </div>
      <div className="flex justify-center gap-2">
        <Button asChild>
          <Link href="/seeker/settings/cert-profile" data-testid="empty-state-complete-profile">
            Complete your profile →
          </Link>
        </Button>
        <Button variant="outline" onClick={onRecompute} data-testid="empty-state-recompute">
          Compute matches
        </Button>
      </div>
    </Card>
  );
}
