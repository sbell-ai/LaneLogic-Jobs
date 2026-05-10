// Diagnostic for the seed agent.
// Run with: npx tsx script/runSeedAgentDiagnostic.ts [--full] [--cap=N]
//
// Default: just runs the scrapers (Phase 1) and reports raw counts. This
// avoids burning Claude tokens on hundreds of postings during selector
// debugging. Pass --full to run the orchestrator end-to-end.
// Pass --cap=N (with --full) to truncate each source's queue to N postings
// before normalize. Overrides SEED_PER_SOURCE_CAP env var.

import { runSeedAgent } from "../server/lib/seedAgent";
import { runIndeedScraper } from "../server/lib/scrapers/indeedScraper";
import { runDatScraper } from "../server/lib/scrapers/datScraper";
import { runGreenhouseScraper } from "../server/lib/scrapers/greenhouseScraper";
import { runWorkdayScraper } from "../server/lib/scrapers/workdayScraper";
import { runCompanyPageScraper } from "../server/lib/scrapers/companyPageScraper";

const FULL = process.argv.includes("--full");
const CAP = (() => {
  const arg = process.argv.find((a) => a.startsWith("--cap="));
  if (!arg) return undefined;
  const n = Number(arg.slice("--cap=".length));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
})();

async function main() {
  console.log("=== Seed agent diagnostic run ===");
  console.log(
    `mode=${FULL ? "full (scrape+normalize+seed)" : "scrape-only"}` +
      (CAP !== undefined ? `, perSourceCap=${CAP}` : ""),
  );
  console.log(`node=${process.version}`);
  console.log(
    `env: ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY ? "yes" : "no"}, ` +
      `INDEED_PUBLISHER_ID=${process.env.INDEED_PUBLISHER_ID ? "yes" : "no"}, ` +
      `GREENHOUSE_BOARDS=${process.env.GREENHOUSE_BOARDS ? "yes" : "no"}, ` +
      `WORKDAY_TARGETS=${process.env.WORKDAY_TARGETS ? "yes" : "no"}, ` +
      `COMPANY_TARGETS=${process.env.COMPANY_TARGETS ? "yes" : "no"}`,
  );
  console.log("---");

  if (FULL) {
    const result = await runSeedAgent(
      "admin",
      undefined,
      CAP !== undefined ? { perSourceCap: CAP } : undefined,
    );
    console.log("---");
    console.log("=== Final result ===");
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  // Scrape-only: run each scraper in parallel, report counts.
  const sources = ["indeed", "dat", "greenhouse", "workday", "company"] as const;
  const fns = [
    runIndeedScraper,
    runDatScraper,
    runGreenhouseScraper,
    runWorkdayScraper,
    runCompanyPageScraper,
  ];
  const settled = await Promise.allSettled(fns.map((fn) => fn()));

  console.log("---");
  console.log("=== Scrape-only summary ===");
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    const r = settled[i];
    if (r.status === "fulfilled") {
      console.log(`  ${s}: ${r.value.length} postings`);
      if (r.value.length > 0) {
        const sample = r.value[0];
        console.log(
          `    sample: "${sample.raw_title}" @ ${sample.raw_company} — ${sample.raw_location}`,
        );
      }
    } else {
      console.log(`  ${s}: REJECTED — ${r.reason instanceof Error ? r.reason.message : r.reason}`);
    }
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("DIAGNOSTIC FATAL:", err);
  process.exit(1);
});
