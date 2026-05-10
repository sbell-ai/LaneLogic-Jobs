import { useQuery } from "@tanstack/react-query";
import type { MatchDetail } from "@shared/matchTypes";

export const matchDetailQueryKey = (jobId: number | null) =>
  ["/api/matches", jobId, "detail"] as const;

export function useMatchDetail(jobId: number | null, enabled: boolean = true) {
  return useQuery<MatchDetail>({
    queryKey: matchDetailQueryKey(jobId),
    queryFn: async () => {
      if (!jobId) throw new Error("No jobId");
      const res = await fetch(`/api/matches/${jobId}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to load match detail: ${res.status}`);
      return res.json();
    },
    enabled: !!jobId && enabled,
  });
}
