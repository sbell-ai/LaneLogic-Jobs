// Sprint 7 — admin hook for paginated seed-run history.
//
// The list query is short-cache + windowed; a 10s refetchInterval keeps the
// most recent row updating while the agent is mid-run without driving the
// hook crazy.

import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "@/lib/queryClient";

export type SeedSource = "indeed" | "dat" | "truckingtruth" | "workday" | "company";

export type SeedLogListRow = {
  id: number;
  startedAt: string;
  completedAt: string | null;
  triggeredBy: "cron" | "admin";
  adminUserId: number | null;
  totalScraped: number;
  totalInserted: number;
  totalSkipped: number;
  totalErrors: number;
};

export type SeedLogListResponse = {
  rows: SeedLogListRow[];
  total: number;
  limit: number;
  offset: number;
};

export function useSeedLogs(limit = 25, offset = 0) {
  return useQuery<SeedLogListResponse>({
    queryKey: ["/api/admin/seed/logs", limit, offset],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/seed/logs?limit=${limit}&offset=${offset}`);
      return res.json();
    },
    refetchInterval: 10_000,
  });
}
