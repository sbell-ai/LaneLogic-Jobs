import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { MatchListResponse } from "@shared/matchTypes";

export type MatchListFilters = {
  sort?: "score" | "experience" | "location";
  order?: "asc" | "desc";
  minScore?: number;
  hideDisqualified?: boolean;
  page?: number;
  limit?: number;
};

function buildQuery(filters: MatchListFilters): string {
  const sp = new URLSearchParams();
  if (filters.sort) sp.set("sort", filters.sort);
  if (filters.order) sp.set("order", filters.order);
  if (typeof filters.minScore === "number") sp.set("min_score", String(filters.minScore));
  if (filters.hideDisqualified) sp.set("has_disqualifier", "false");
  if (filters.page) sp.set("page", String(filters.page));
  if (filters.limit) sp.set("limit", String(filters.limit));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const matchesQueryKey = (filters: MatchListFilters) =>
  ["/api/matches", filters] as const;

export function useMatches(filters: MatchListFilters) {
  return useQuery<MatchListResponse>({
    queryKey: matchesQueryKey(filters),
    queryFn: async () => {
      const res = await fetch(`/api/matches${buildQuery(filters)}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to load matches: ${res.status}`);
      return res.json();
    },
  });
}

export function useRecomputeMatches() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/matches/compute", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
    },
  });
}
