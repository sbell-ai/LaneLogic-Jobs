// Sprint 7 — Seed agent orchestrator.
//
// Glues the three layers together: scrapers run in parallel (one failure
// shouldn't abort the run), normalization + writes run sequentially per
// posting (so Nominatim's 1-req/sec rate limit is respected without an
// extra queue). The seed_log row is written eagerly at start so the admin
// UI can poll progress, then patched at the end with final counts.

import { eq } from "drizzle-orm";

import { db } from "../db";
import { seedLog } from "@shared/schema";

import {
  emptyPerSourceStats,
  type ScrapedJobRaw,
  type SeedErrorEntry,
  type SeedRunResult,
  type SeedSource,
  type SourceStats,
} from "../../shared/seedTypes";
import { normalizeJob } from "./jobNormalizer";
import { seedJob } from "./jobSeeder";
import { runIndeedScraper } from "./scrapers/indeedScraper";
import { runDatScraper } from "./scrapers/datScraper";
import { runGreenhouseScraper } from "./scrapers/greenhouseScraper";
import { runWorkdayScraper } from "./scrapers/workdayScraper";
import { runCompanyPageScraper } from "./scrapers/companyPageScraper";

type ScraperFn = () => Promise<ScrapedJobRaw[]>;

const SCRAPERS: Record<SeedSource, ScraperFn> = {
  indeed: runIndeedScraper,
  dat: runDatScraper,
  greenhouse: runGreenhouseScraper,
  workday: runWorkdayScraper,
  company: runCompanyPageScraper,
};

// In-memory cancellation registry. The cancel endpoint adds a logId here;
// the orchestrator checks it between sources/postings and bails into Phase 3
// when set. State is per-process — if the server restarts, in-flight runs are
// already dead anyway, and the endpoint's eager DB write covers that case.
const cancelledRuns = new Set<number>();

export function requestCancel(logId: number): void {
  cancelledRuns.add(logId);
}

export function isCancelled(logId: number): boolean {
  return cancelledRuns.has(logId);
}

const CANCEL_MARKER_TEXT = "cancelled by admin";

function hasCancelMarker(errorLog: SeedErrorEntry[]): boolean {
  return errorLog.some((e) => e.source === "admin" && e.error === CANCEL_MARKER_TEXT);
}

// Mid-run progress flush. Writes counter rollups, perSource, and errorLog —
// never completed_at, so the cancel endpoint's eager finalize survives.
//
// If a cancel has been requested, the marker is appended to the in-memory
// errorLog before the UPDATE so this flush doesn't temporarily overwrite
// the marker the cancel endpoint already wrote. Phase 3 then short-circuits
// the marker push to avoid duplicates.
//
// DB errors are swallowed: a transient connection blip during a live run
// must not kill the agent. Phase 3's final UPDATE still produces the
// correct end-state regardless of whether progress flushes succeeded.
async function flushProgress(
  logId: number,
  perSource: Record<SeedSource, SourceStats>,
  errorLog: SeedErrorEntry[],
): Promise<void> {
  if (isCancelled(logId) && !hasCancelMarker(errorLog)) {
    errorLog.push({ source: "admin", url: "", error: CANCEL_MARKER_TEXT });
  }

  let totalScraped = 0;
  let totalNormalized = 0;
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  for (const s of Object.values(perSource)) {
    totalScraped += s.scraped;
    totalNormalized += s.normalized;
    totalInserted += s.inserted;
    totalSkipped += s.skipped;
    totalErrors += s.errors;
  }

  try {
    await db
      .update(seedLog)
      .set({
        totalScraped,
        totalNormalized,
        totalInserted,
        totalSkipped,
        totalErrors,
        perSource,
        errorLog,
      } as any)
      .where(eq(seedLog.id, logId));
  } catch (err) {
    console.warn(`[seedAgent] progress flush failed for run #${logId}:`, err);
  }
}

export async function startSeedRun(
  triggeredBy: "cron" | "admin",
  adminUserId?: number,
): Promise<number> {
  const [row] = await db
    .insert(seedLog)
    .values({
      triggeredBy,
      adminUserId: adminUserId ?? null,
    } as any)
    .returning({ id: seedLog.id });
  return row.id;
}

export type RunSeedAgentOptions = {
  // Truncate each source's queue to this many postings before feeding the
  // normalizer. Useful for the first real run so we don't push hundreds of
  // jobs through Claude in one shot. <=0 disables the cap.
  perSourceCap?: number;
};

// Resolves the effective cap for a given run. Explicit option wins; falls
// back to SEED_PER_SOURCE_CAP env var; 0/unset = no cap.
function resolvePerSourceCap(opts?: RunSeedAgentOptions): number {
  if (opts && typeof opts.perSourceCap === "number") {
    return opts.perSourceCap > 0 ? Math.floor(opts.perSourceCap) : 0;
  }
  const envRaw = process.env.SEED_PER_SOURCE_CAP;
  if (!envRaw) return 0;
  const n = Number(envRaw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export async function runSeedAgent(
  triggeredBy: "cron" | "admin",
  adminUserId?: number,
  options?: RunSeedAgentOptions,
): Promise<SeedRunResult> {
  const logId = await startSeedRun(triggeredBy, adminUserId);
  return runSeedAgentForExistingLog(logId, options);
}

// The admin endpoint creates the log row eagerly so it can return a log_id in
// the HTTP response, then hands the id off here. Cron uses runSeedAgent above
// (which just adopts the same path).
export async function runSeedAgentForExistingLog(
  logId: number,
  options?: RunSeedAgentOptions,
): Promise<SeedRunResult> {
  const startedAt = Date.now();
  const perSource = emptyPerSourceStats();
  const errorLog: SeedErrorEntry[] = [];
  const perSourceCap = resolvePerSourceCap(options);
  if (perSourceCap > 0) {
    console.log(`[seedAgent] per-source cap = ${perSourceCap}`);
  }

  // Phase 1 — scrape everything in parallel. allSettled means a single
  // scraper exception doesn't stop the others.
  const sources = Object.keys(SCRAPERS) as SeedSource[];
  const settled = await Promise.allSettled(sources.map((s) => SCRAPERS[s]()));

  const scraped: Array<{ source: SeedSource; jobs: ScrapedJobRaw[] }> = [];
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    const r = settled[i];
    if (r.status === "fulfilled") {
      perSource[source].scraped = r.value.length;
      scraped.push({ source, jobs: r.value });
      console.log(
        `[seed:${source}] status: fulfilled, raw count: ${r.value.length}`,
      );
    } else {
      perSource[source].errors += 1;
      const message = r.reason instanceof Error ? r.reason.message : String(r.reason);
      errorLog.push({ source, url: "", error: `scraper threw: ${message}` });
      console.log(
        `[seed:${source}] status: rejected, raw count: 0, error: ${message}`,
      );
      console.error(`[seedAgent] scraper "${source}" failed:`, r.reason);
    }
  }

  // Initial flush — make scraped counts and any scraper-rejection errors
  // visible in the UI immediately, without waiting for the first Phase 2
  // posting to complete.
  await flushProgress(logId, perSource, errorLog);

  // Phase 2 — normalize + write sequentially per posting. Nominatim is
  // 1 req/s; the normalizer enforces the throttle internally so we just
  // serialize here.
  sourceLoop: for (const { source, jobs: rawJobs } of scraped) {
    if (isCancelled(logId)) {
      console.log(`[seedAgent] run #${logId} cancellation detected — bailing out`);
      break sourceLoop;
    }
    const queue =
      perSourceCap > 0 && rawJobs.length > perSourceCap
        ? rawJobs.slice(0, perSourceCap)
        : rawJobs;
    if (queue.length < rawJobs.length) {
      console.log(
        `[seed:${source}] cap applied: processing ${queue.length} of ${rawJobs.length}`,
      );
    }
    for (const raw of queue) {
      if (isCancelled(logId)) {
        console.log(`[seedAgent] run #${logId} cancellation detected — bailing out`);
        break sourceLoop;
      }
      const stats: SourceStats = perSource[source];
      try {
        const normalized = await normalizeJob(raw);
        if (!normalized) {
          stats.errors += 1;
          errorLog.push({
            source,
            url: raw.source_url,
            error: "normalizer returned null",
          });
          continue;
        }
        stats.normalized += 1;

        const result = await seedJob(normalized);
        if (result.outcome === "inserted") {
          stats.inserted += 1;
        } else if (result.outcome === "skipped") {
          stats.skipped += 1;
        } else {
          stats.errors += 1;
          if (result.error) errorLog.push(result.error);
        }
      } catch (err) {
        stats.errors += 1;
        const message = err instanceof Error ? err.message : String(err);
        errorLog.push({ source, url: raw.source_url, error: message });
        console.error(`[seedAgent] uncaught error processing ${raw.source_url}:`, err);
      }

      // Per-posting progress flush — keeps the View Details panel updating
      // in near-real-time (the UI polls every 3s, this flush fires every
      // ~5s on average given Nominatim + Claude latency).
      await flushProgress(logId, perSource, errorLog);
    }
  }

  // Phase 3 — finalize the seed_log row with rollups.
  const wasCancelled = isCancelled(logId);
  if (wasCancelled && !hasCancelMarker(errorLog)) {
    errorLog.push({ source: "admin", url: "", error: CANCEL_MARKER_TEXT });
  }

  let totalScraped = 0;
  let totalNormalized = 0;
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  for (const s of Object.values(perSource)) {
    totalScraped += s.scraped;
    totalNormalized += s.normalized;
    totalInserted += s.inserted;
    totalSkipped += s.skipped;
    totalErrors += s.errors;
  }

  const completedAt = new Date();
  await db
    .update(seedLog)
    .set({
      completedAt,
      totalScraped,
      totalNormalized,
      totalInserted,
      totalSkipped,
      totalErrors,
      perSource,
      errorLog,
    } as any)
    .where(eq(seedLog.id, logId));

  const duration_ms = Date.now() - startedAt;
  console.log(
    `[seedAgent] run #${logId} ${wasCancelled ? "cancelled" : "complete"} — ` +
      `scraped=${totalScraped} inserted=${totalInserted} skipped=${totalSkipped} errors=${totalErrors} in ${duration_ms}ms`,
  );

  // Drop the registry entry so a future run reusing the same id (unlikely
  // since the id is a serial, but cheap insurance) doesn't pick up stale
  // state. Always do this — the run is over either way.
  cancelledRuns.delete(logId);

  return {
    log_id: logId,
    total_scraped: totalScraped,
    total_normalized: totalNormalized,
    total_inserted: totalInserted,
    total_skipped: totalSkipped,
    total_errors: totalErrors,
    per_source: perSource,
    duration_ms,
  };
}
