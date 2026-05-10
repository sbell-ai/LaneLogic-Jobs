// Recompute cached match scores when a job's credential requirements change.
// Sprint 5 wires this to the matchScoreCache layer (was a no-op log line in
// Sprint 4). Called by the job-requirements POST/PATCH/DELETE handlers.

import { recomputeForJob } from "../lib/matchScoreCache";

export async function recalculateMatchScoresForJob(jobId: number): Promise<void> {
  try {
    const result = await recomputeForJob(jobId);
    console.log(
      `[match-recalc] job=${jobId} upserted=${result.upserted} skipped=${result.skipped}`,
    );
  } catch (err) {
    // Don't let scoring errors block requirement edits — log and move on.
    console.error(`[match-recalc] failed for job=${jobId}:`, err);
  }
}
