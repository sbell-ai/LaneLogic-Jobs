// Sprint 7 — single row in the run history table. Click [View Details] to
// fetch the full detail and expand the per-source breakdown below the row.

import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { useSeedLogDetail } from "@/hooks/useSeedRun";
import type { SeedLogListRow } from "@/hooks/useSeedLogs";
import { SeedRunDetail } from "./SeedRunDetail";

export function SeedRunRow({ row }: { row: SeedLogListRow }) {
  const [expanded, setExpanded] = useState(false);
  const detail = useSeedLogDetail(expanded ? row.id : null);

  const completed = !!row.completedAt;
  const startedAt = new Date(row.startedAt);

  return (
    <>
      <tr className="border-t border-border hover:bg-muted/40">
        <td className="px-3 py-2 text-sm">
          <div className="font-medium">{format(startedAt, "MMM d HH:mm")}</div>
          <div className="text-xs text-muted-foreground">
            {formatDistanceToNow(startedAt, { addSuffix: true })}
          </div>
        </td>
        <td className="px-3 py-2 text-sm">
          <Badge variant={row.triggeredBy === "cron" ? "secondary" : "default"}>
            {row.triggeredBy}
          </Badge>
        </td>
        <td className="px-3 py-2 text-sm tabular-nums">{row.totalScraped}</td>
        <td className="px-3 py-2 text-sm tabular-nums">{row.totalInserted}</td>
        <td className="px-3 py-2 text-sm tabular-nums">{row.totalSkipped}</td>
        <td className="px-3 py-2 text-sm tabular-nums">
          {row.totalErrors > 0 ? (
            <Badge variant="destructive" className="px-1.5 py-0">
              {row.totalErrors}
            </Badge>
          ) : (
            0
          )}
        </td>
        <td className="px-3 py-2 text-sm">
          {completed ? (
            <Badge variant="outline">complete</Badge>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> running
            </span>
          )}
        </td>
        <td className="px-3 py-2 text-sm text-right">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs"
          >
            {expanded ? (
              <>
                <ChevronDown className="h-3 w-3 mr-1" /> Hide
              </>
            ) : (
              <>
                <ChevronRight className="h-3 w-3 mr-1" /> View Details
              </>
            )}
          </Button>
        </td>
      </tr>
      {expanded && detail.data && (
        <tr>
          <td colSpan={8} className="p-0">
            <SeedRunDetail detail={detail.data} />
          </td>
        </tr>
      )}
      {expanded && detail.isLoading && (
        <tr>
          <td colSpan={8} className="px-3 py-3 text-center text-sm text-muted-foreground">
            Loading details…
          </td>
        </tr>
      )}
    </>
  );
}
