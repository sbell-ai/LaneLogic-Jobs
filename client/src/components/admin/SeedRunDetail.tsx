// Sprint 7 — per-source breakdown for one seed run.
// Rendered inline as the expanded row below SeedRunRow, or in the active
// run panel while the agent is mid-flight.

import { Badge } from "@/components/ui/badge";

import type { SeedLogDetail, SeedSourceStats } from "@/hooks/useSeedRun";
import type { SeedSource } from "@/hooks/useSeedLogs";

const SOURCE_LABELS: Record<SeedSource, string> = {
  indeed: "Indeed",
  dat: "DAT",
  greenhouse: "Greenhouse",
  workday: "Workday",
  company: "Company",
};

const SOURCE_ORDER: SeedSource[] = ["indeed", "dat", "greenhouse", "workday", "company"];

function emptyStats(): SeedSourceStats {
  return { scraped: 0, normalized: 0, inserted: 0, skipped: 0, errors: 0 };
}

export function SeedRunDetail({ detail }: { detail: SeedLogDetail }) {
  const perSource = detail.perSource ?? null;
  const errors = detail.errorLog ?? [];

  return (
    <div className="space-y-4 px-4 py-3 bg-muted/40 border-t border-border">
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
          Per-Source Breakdown
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="px-2 py-1 font-medium">Source</th>
                <th className="px-2 py-1 font-medium text-right">Scraped</th>
                <th className="px-2 py-1 font-medium text-right">Normalized</th>
                <th className="px-2 py-1 font-medium text-right">Inserted</th>
                <th className="px-2 py-1 font-medium text-right">Skipped</th>
                <th className="px-2 py-1 font-medium text-right">Errors</th>
              </tr>
            </thead>
            <tbody>
              {SOURCE_ORDER.map((source) => {
                const stats = (perSource?.[source] ?? emptyStats()) as SeedSourceStats;
                return (
                  <tr key={source} className="border-t border-border/60">
                    <td className="px-2 py-1 font-medium">{SOURCE_LABELS[source]}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{stats.scraped}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{stats.normalized}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{stats.inserted}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{stats.skipped}</td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {stats.errors > 0 ? (
                        <Badge variant="destructive" className="px-1.5 py-0 text-xs">
                          {stats.errors}
                        </Badge>
                      ) : (
                        0
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {errors.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
            Errors ({errors.length})
          </div>
          <ul className="space-y-1 max-h-48 overflow-auto text-xs font-mono">
            {errors.map((e, i) => (
              <li key={i} className="text-destructive">
                <span className="text-muted-foreground">[{e.source}]</span>{" "}
                {e.url ? (
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {e.url}
                  </a>
                ) : (
                  "(no url)"
                )}
                {" — "}
                {e.error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
