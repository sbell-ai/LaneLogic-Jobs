// Sprint 7 — admin hook to trigger a seed run and poll one log row to completion.
//
// `useSeedRun` exposes both the trigger mutation and a polling subscription
// keyed on the active log id; the panel consumes both.

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiRequest } from "@/lib/queryClient";
import type { SeedSource } from "./useSeedLogs";

export type SeedSourceStats = {
  scraped: number;
  normalized: number;
  inserted: number;
  skipped: number;
  errors: number;
};

export type SeedLogDetail = {
  id: number;
  startedAt: string;
  completedAt: string | null;
  triggeredBy: "cron" | "admin";
  adminUserId: number | null;
  totalScraped: number;
  totalNormalized: number;
  totalInserted: number;
  totalSkipped: number;
  totalErrors: number;
  perSource: Record<SeedSource, SeedSourceStats> | null;
  errorLog: Array<{ source: SeedSource; url: string; error: string }> | null;
};

export type StartRunResponse = {
  log_id: number;
  status: "started";
  message: string;
};

export function useSeedLogDetail(logId: number | null) {
  return useQuery<SeedLogDetail>({
    queryKey: ["/api/admin/seed/logs", logId],
    enabled: logId !== null,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/seed/logs/${logId}`);
      return res.json();
    },
    // Poll while the row hasn't finalized; stop once completedAt is set.
    refetchInterval: (query) =>
      query.state.data && query.state.data.completedAt ? false : 3_000,
  });
}

export function useTriggerSeedRun() {
  const qc = useQueryClient();
  return useMutation<StartRunResponse, Error, void>({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/seed/run");
      return res.json();
    },
    onSuccess: () => {
      // Refetch the list so the new in-flight row appears immediately.
      qc.invalidateQueries({ queryKey: ["/api/admin/seed/logs"] });
    },
  });
}

// Convenience: track a "currently running" log id across re-renders.
export function useActiveSeedRun() {
  const [activeLogId, setActiveLogId] = useState<number | null>(null);
  const detailQuery = useSeedLogDetail(activeLogId);

  // Auto-clear the tracker once the run finishes so the UI stops polling.
  useEffect(() => {
    if (detailQuery.data?.completedAt) {
      // Leave activeLogId set so the component can still display the result;
      // the polling stops because refetchInterval returns false.
    }
  }, [detailQuery.data?.completedAt]);

  return { activeLogId, setActiveLogId, detailQuery };
}
