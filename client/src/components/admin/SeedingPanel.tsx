// Sprint 7 — Job Seeding admin panel.
//
// "Run Seed Agent Now" button kicks off the agent fire-and-forget on the
// server; the UI then polls the new log row every 3s until completedAt is
// set. Recent run history sits underneath as an expandable table.

import { useEffect, useMemo, useState } from "react";
import { Loader2, Play, X } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

import { useSeedLogs } from "@/hooks/useSeedLogs";
import {
  useCancelSeedRun,
  useSeedLogDetail,
  useTriggerSeedRun,
} from "@/hooks/useSeedRun";
import { SeedRunRow } from "./SeedRunRow";
import { SeedRunDetail } from "./SeedRunDetail";

export function SeedingPanel() {
  const { toast } = useToast();
  const logs = useSeedLogs(25, 0);
  const trigger = useTriggerSeedRun();
  const cancel = useCancelSeedRun();

  const [activeLogId, setActiveLogId] = useState<number | null>(null);
  const activeDetail = useSeedLogDetail(activeLogId);

  const lastCompleted = useMemo(() => {
    return logs.data?.rows.find((r) => r.completedAt) ?? null;
  }, [logs.data]);

  // Active run id from either the local mutation result or the most recent
  // uncompleted row in the history list. Lets a user cancel a run that was
  // started in another browser session / before page load.
  const inflightFromList = useMemo(() => {
    return logs.data?.rows.find((r) => !r.completedAt)?.id ?? null;
  }, [logs.data]);
  const cancelTargetId = activeLogId ?? inflightFromList;

  const isRunning =
    trigger.isPending ||
    (activeLogId !== null && activeDetail.data && !activeDetail.data.completedAt) ||
    inflightFromList !== null;

  useEffect(() => {
    if (activeDetail.data?.completedAt && activeLogId !== null) {
      // Run finished — pull the list one more time so the row promotes from
      // "running" to "complete".
      logs.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDetail.data?.completedAt]);

  async function handleRun() {
    try {
      const result = await trigger.mutateAsync();
      setActiveLogId(result.log_id);
      toast({
        title: "Seed agent started",
        description: `Run #${result.log_id} is running in the background.`,
      });
    } catch (err) {
      toast({
        title: "Failed to start seed agent",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  }

  async function handleCancel(targetId: number) {
    try {
      const result = await cancel.mutateAsync({ logId: targetId });
      toast({
        title: "Seed agent cancelled",
        description: `Run #${result.log_id} stopped.`,
      });
    } catch (err) {
      toast({
        title: "Cancel failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Job Seeding</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Run the AI seeding agent to scrape, normalize, and persist real job
          postings from Indeed, DAT, Greenhouse boards, Workday, and
          configured company career pages.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 p-4 border border-border rounded-lg bg-card">
        <div className="flex items-center gap-2">
          <Button
            onClick={handleRun}
            disabled={!!isRunning}
            data-testid="run-seed-agent-button"
            className="gap-2"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Running…
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> Run Seed Agent Now
              </>
            )}
          </Button>
          {isRunning && cancelTargetId !== null && (
            <Button
              onClick={() => handleCancel(cancelTargetId)}
              disabled={cancel.isPending}
              variant="destructive"
              data-testid="cancel-seed-agent-button"
              className="gap-2"
            >
              {cancel.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
              Cancel
            </Button>
          )}
        </div>
        <div className="text-sm text-muted-foreground text-right">
          {lastCompleted ? (
            <>
              <div>
                Last run:{" "}
                <span className="font-medium">
                  {formatDistanceToNow(new Date(lastCompleted.startedAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
              <div>
                {lastCompleted.totalInserted} inserted ·{" "}
                {lastCompleted.totalSkipped} skipped ·{" "}
                {lastCompleted.totalErrors} errors
              </div>
            </>
          ) : (
            "No completed runs yet"
          )}
        </div>
      </div>

      {activeLogId !== null && activeDetail.data && !activeDetail.data.completedAt && (
        <div className="border border-primary/40 rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-primary/5 text-sm font-medium flex items-center justify-between gap-4">
            <span>
              Run #{activeLogId} in progress —{" "}
              <span className="font-normal text-muted-foreground">
                started {format(new Date(activeDetail.data.startedAt), "HH:mm:ss")}
              </span>
            </span>
            <Button
              onClick={() => handleCancel(activeLogId)}
              disabled={cancel.isPending}
              variant="destructive"
              size="sm"
              data-testid="cancel-active-run-button"
              className="gap-1.5"
            >
              {cancel.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <X className="h-3 w-3" />
              )}
              Cancel
            </Button>
          </div>
          <SeedRunDetail detail={activeDetail.data} />
        </div>
      )}

      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase mb-2 px-1">
          Run History
        </div>
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          <table className="w-full">
            <thead className="bg-muted/40">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-3 py-2 font-medium">Started</th>
                <th className="px-3 py-2 font-medium">Triggered</th>
                <th className="px-3 py-2 font-medium">Scraped</th>
                <th className="px-3 py-2 font-medium">Inserted</th>
                <th className="px-3 py-2 font-medium">Skipped</th>
                <th className="px-3 py-2 font-medium">Errors</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {logs.isLoading && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Loading runs…
                  </td>
                </tr>
              )}
              {logs.data && logs.data.rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No runs yet. Click "Run Seed Agent Now" to start one.
                  </td>
                </tr>
              )}
              {logs.data?.rows.map((row) => (
                <SeedRunRow key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default SeedingPanel;
