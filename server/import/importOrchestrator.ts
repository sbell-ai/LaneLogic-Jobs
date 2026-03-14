import { storage } from "../storage";
import { startActorRun, pollRunStatus, fetchDatasetTsv } from "./apifyClient";
import { parseTsv } from "./tsvParser";
import { mapTsvRow } from "./fieldMapper";
import type { JobSource, JobImportRun } from "@shared/schema";

const MAX_ROWS_PER_RUN = 8000;
const MAX_RUNTIME_MINUTES = 12;
const MAX_DOMAINS_TOUCHED_PER_RUN = 250;

export async function runImport(source: JobSource, singleImportTargetId?: number): Promise<void> {
  const run = await storage.createJobImportRun({
    sourceId: source.id,
    status: "running",
    startedAt: new Date(),
    actorInputJson: source.actorInputJson,
  });

  const warnings: string[] = [];
  let statsCreated = 0;
  let statsUpdated = 0;
  let statsSkipped = 0;
  let statsExpired = 0;
  const startTime = Date.now();

  try {
    console.log(`[import] Starting Apify run for source ${source.id} (${source.name})`);

    const actorRun = await startActorRun(source.actorId, source.actorInputJson);
    await storage.updateJobImportRun(run.id, {
      apifyRunId: actorRun.id,
    });

    console.log(`[import] Apify run ${actorRun.id} started, polling...`);
    const completedRun = await pollRunStatus(actorRun.id, MAX_RUNTIME_MINUTES * 60 * 1000);

    await storage.updateJobImportRun(run.id, {
      apifyDatasetId: completedRun.defaultDatasetId,
    });

    console.log(`[import] Fetching TSV dataset ${completedRun.defaultDatasetId}...`);
    const tsvContent = await fetchDatasetTsv(completedRun.defaultDatasetId);

    const rows = parseTsv(tsvContent);
    console.log(`[import] Parsed ${rows.length} rows from TSV`);

    let hitRowCap = false;
    let hitTimeCap = false;
    let hitDomainCap = false;

    const seenByTarget = new Map<number, Set<string>>();
    const domainsProcessed = new Set<string>();
    const previousJobCounts = new Map<number, number>();

    for (let i = 0; i < rows.length; i++) {
      if (i >= MAX_ROWS_PER_RUN) {
        hitRowCap = true;
        warnings.push(`Hit MAX_ROWS_PER_RUN cap (${MAX_ROWS_PER_RUN}), stopped at row ${i}`);
        break;
      }
      const elapsedMinutes = (Date.now() - startTime) / 60000;
      if (elapsedMinutes >= MAX_RUNTIME_MINUTES) {
        hitTimeCap = true;
        warnings.push(`Hit MAX_RUNTIME_MINUTES cap (${MAX_RUNTIME_MINUTES}), stopped at row ${i}`);
        break;
      }

      const mapped = mapTsvRow(rows[i]);
      if ("error" in mapped) {
        statsSkipped++;
        warnings.push(`Row ${i}: ${mapped.error}`);
        continue;
      }

      if (domainsProcessed.size >= MAX_DOMAINS_TOUCHED_PER_RUN && !domainsProcessed.has(mapped.sourceDomain)) {
        hitDomainCap = true;
        statsSkipped++;
        continue;
      }
      domainsProcessed.add(mapped.sourceDomain);

      const target = await storage.upsertImportTarget(
        source.id,
        mapped.sourceDomain,
        mapped.companyName,
        mapped.employerWebsiteDomain
      );

      if (singleImportTargetId && target.id !== singleImportTargetId) {
        statsSkipped++;
        continue;
      }

      if (target.status === "blocked") {
        statsSkipped++;
        continue;
      }

      if (target.status === "pending_review" || target.status === "paused") {
        statsSkipped++;
        continue;
      }

      if (!previousJobCounts.has(target.id)) {
        const cnt = await storage.getJobCountByImportTarget(target.id);
        previousJobCounts.set(target.id, cnt);
      }

      if (!seenByTarget.has(target.id)) {
        seenByTarget.set(target.id, new Set());
      }
      seenByTarget.get(target.id)!.add(mapped.externalJobId);

      try {
        const result = await storage.upsertImportedJob(source.id, target.id, mapped.externalJobId, {
          title: mapped.title,
          companyName: mapped.companyName,
          description: mapped.description,
          requirements: "",
          sourceUrl: mapped.sourceUrl,
          applyUrl: mapped.sourceUrl,
          employmentType: mapped.employmentType,
          locationCity: mapped.locationCity,
          locationState: mapped.locationState,
          locationCountry: mapped.locationCountry,
          isRemote: mapped.isRemote,
          externalPostedAt: mapped.externalPostedAt,
          externalCreatedAt: mapped.externalCreatedAt,
          externalValidThrough: mapped.externalValidThrough,
          rawSourceSnippet: mapped.rawSourceSnippet,
          jobType: mapped.employmentType,
        });
        if (result.action === "created") statsCreated++;
        else if (result.action === "updated") statsUpdated++;
        else statsSkipped++;
      } catch (err: any) {
        statsSkipped++;
        warnings.push(`Row ${i} upsert error: ${err.message}`);
      }
    }

    if (hitDomainCap) {
      warnings.push(`Hit MAX_DOMAINS_TOUCHED_PER_RUN cap (${MAX_DOMAINS_TOUCHED_PER_RUN})`);
    }

    const hasWarnings = hitRowCap || hitTimeCap || hitDomainCap;
    const finalStatus = hasWarnings ? "succeeded_with_warnings" : "succeeded";

    if (finalStatus === "succeeded" && !singleImportTargetId) {
      for (const [targetId, seenIds] of seenByTarget.entries()) {
        const previousCount = previousJobCounts.get(targetId) || 0;
        const newCount = seenIds.size;

        if (previousCount > 0 && newCount === 0) {
          warnings.push(`Anomaly: domain target ${targetId} dropped from ${previousCount} to 0 jobs, skipping expiry`);
          continue;
        }
        if (previousCount > 10 && newCount < previousCount * 0.1) {
          warnings.push(`Anomaly: domain target ${targetId} dropped by 90%+ (${previousCount} → ${newCount}), skipping expiry`);
          continue;
        }

        const expired = await storage.expireJobsNotInSet(targetId, Array.from(seenIds));
        statsExpired += expired;
      }
    }

    await storage.updateJobImportRun(run.id, {
      status: finalStatus,
      finishedAt: new Date(),
      statsCreated,
      statsUpdated,
      statsSkipped,
      statsExpired,
      warnings: warnings.length > 0 ? warnings : null,
    });

    if (finalStatus === "succeeded") {
      await storage.updateJobSource(source.id, {
        lastSuccessfulRunAt: new Date(),
        consecutiveFailures: 0,
      } as any);
    }

    console.log(`[import] Run ${run.id} finished: ${finalStatus} (created=${statsCreated}, updated=${statsUpdated}, skipped=${statsSkipped}, expired=${statsExpired})`);
  } catch (err: any) {
    console.error(`[import] Run ${run.id} failed:`, err.message);
    await storage.updateJobImportRun(run.id, {
      status: "failed",
      finishedAt: new Date(),
      lastError: err.message,
      statsCreated,
      statsUpdated,
      statsSkipped,
      statsExpired,
      warnings: warnings.length > 0 ? warnings : null,
    });

    const currentSource = await storage.getJobSource(source.id);
    const failures = (currentSource?.consecutiveFailures || 0) + 1;
    await storage.updateJobSource(source.id, { consecutiveFailures: failures } as any);
  }
}
