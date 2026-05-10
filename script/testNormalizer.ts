// Fixture test for jobNormalizer (Sprint 7).
// Run with: npx tsx script/testNormalizer.ts
//
// Hits real Claude + real Nominatim. Exits non-zero on validation failure so
// it can be wired into CI later. Not a unit test — a smoke check that the
// prompt + parser + geocoder agree on a realistic posting.

import { normalizeJob, computeSourceHash } from "../server/lib/jobNormalizer";
import type { ScrapedJobRaw } from "../shared/seedTypes";

const FIXTURE: ScrapedJobRaw = {
  source: "indeed",
  source_url: "https://example.com/jobs/cdl-otr-12345",
  raw_title: "CDL Class A OTR Driver - Hazmat Required",
  raw_company: "Sunbelt Freight LLC",
  raw_location: "Dallas, Texas",
  raw_description: [
    "Sunbelt Freight is hiring experienced Class A CDL drivers for OTR routes",
    "across the southern United States. Drivers run dry van and the occasional",
    "tanker load, with home time every 2-3 weeks.",
    "",
    "Requirements:",
    "- Valid CDL Class A",
    "- Hazmat endorsement (required)",
    "- Minimum 2 years verifiable OTR experience",
    "- Clean MVR for the past 3 years",
    "- DOT medical card current",
    "",
    "Preferred:",
    "- Tanker endorsement",
    "- TWIC card holders get priority",
    "",
    "We pay $0.62/mile loaded and unloaded, plus stop pay and detention.",
  ].join("\n"),
  raw_compensation: "$0.62 per mile + bonuses",
  scraped_at: new Date().toISOString(),
};

type Check = { name: string; pass: boolean; detail: string };

function check(name: string, pass: boolean, detail: string): Check {
  return { name, pass, detail };
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set — fixture test requires a real key");
    process.exit(2);
  }

  console.log("Fixture: CDL Class A OTR Driver, Sunbelt Freight, Dallas TX");
  console.log("Calling normalizeJob (Claude + Nominatim)...\n");

  const t0 = Date.now();
  const result = await normalizeJob(FIXTURE);
  const ms = Date.now() - t0;

  if (!result) {
    console.error(`normalizeJob returned null after ${ms}ms`);
    process.exit(1);
  }

  console.log(`Got result in ${ms}ms:`);
  console.log(JSON.stringify(result, null, 2));
  console.log();

  const expectedHash = computeSourceHash(
    result.title,
    result.company_name,
    result.location_text,
  );

  const checks: Check[] = [
    check("title is non-empty", result.title.length > 0, `"${result.title}"`),
    check(
      "company_name matches fixture",
      /sunbelt/i.test(result.company_name),
      `"${result.company_name}"`,
    ),
    check(
      "location_text looks like 'City, ST'",
      /^[A-Za-z .'-]+,\s*[A-Z]{2}$/.test(result.location_text),
      `"${result.location_text}"`,
    ),
    check(
      "modal_namespace is trucking",
      result.modal_namespace === "trucking",
      result.modal_namespace,
    ),
    check(
      "job_type is full_time",
      result.job_type === "full_time",
      result.job_type,
    ),
    check(
      "CDL_CLASS_A is in required_credential_codes",
      result.required_credential_codes.includes("CDL_CLASS_A"),
      result.required_credential_codes.join(", "),
    ),
    check(
      "END_HAZMAT is in required_credential_codes",
      result.required_credential_codes.includes("END_HAZMAT"),
      result.required_credential_codes.join(", "),
    ),
    check(
      "min_experience_years >= 2",
      result.min_experience_years >= 2,
      String(result.min_experience_years),
    ),
    check(
      "description rewritten (>100 chars, no marketing fluff markers)",
      result.description.length > 100,
      `${result.description.length} chars`,
    ),
    check(
      "source_hash matches recompute",
      result.source_hash === expectedHash,
      result.source_hash,
    ),
    check(
      "lat/lng populated for Dallas, TX",
      result.lat !== null && result.lng !== null &&
        Math.abs(result.lat - 32.78) < 0.5 &&
        Math.abs(result.lng - -96.8) < 0.5,
      `lat=${result.lat}, lng=${result.lng}`,
    ),
  ];

  let failed = 0;
  for (const c of checks) {
    const mark = c.pass ? "PASS" : "FAIL";
    console.log(`  [${mark}] ${c.name} — ${c.detail}`);
    if (!c.pass) failed++;
  }

  console.log();
  if (failed > 0) {
    console.error(`${failed} of ${checks.length} checks failed`);
    process.exit(1);
  }
  console.log(`All ${checks.length} checks passed`);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
