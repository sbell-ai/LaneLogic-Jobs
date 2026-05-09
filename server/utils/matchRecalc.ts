// Placeholder for match-score recomputation triggered when an employer
// changes a job's credential requirements. The current matchCerts() runs
// on-demand in the job listing endpoints, so this is a no-op log line that
// satisfies AC #8 ("log output confirms trigger") and gives a real
// implementation a stable seam to slot into later.

export async function recalculateMatchScoresForJob(jobId: number): Promise<void> {
  console.log(`[match-recalc] requirements changed for job ${jobId} — scores will refresh on next read`);
}
