// Sprint 7 — AI job seeding agent types.
//
// Three layers, three shapes:
//   ScrapedJobRaw   — what scrapers return (unstructured, source-specific)
//   NormalizedJob   — what the Claude normalizer produces (DB-ready)
//   SeedRunResult   — orchestrator return value (per-source rollup)

export const SEED_SOURCES = ["indeed", "dat", "truckingtruth", "workday", "company"] as const;
export type SeedSource = (typeof SEED_SOURCES)[number];

export type SeedJobType = "full_time" | "part_time" | "contract" | "owner_operator";
export type SeedModalNamespace = "trucking" | "maritime" | "aviation" | "logistics";

// Raw output from any scraper — minimal, unvalidated. The normalizer is the
// only thing that should consume this; nothing else trusts these fields.
export type ScrapedJobRaw = {
  source: SeedSource;
  source_url: string;
  raw_title: string;
  raw_company: string;
  raw_location: string;
  raw_description: string;
  raw_compensation?: string;
  scraped_at: string;
};

// Output of AI normalization — structured, ready to persist via jobSeeder.
export type NormalizedJob = {
  title: string;
  company_name: string;
  location_text: string;
  lat: number | null;
  lng: number | null;
  description: string;
  job_type: SeedJobType;
  modal_namespace: SeedModalNamespace;
  required_credential_codes: string[];
  preferred_credential_codes: string[];
  min_experience_years: number;
  source: SeedSource;
  source_url: string;
  source_hash: string;
  is_remote: boolean;
};

export type SourceStats = {
  scraped: number;
  normalized: number;
  inserted: number;
  skipped: number;
  errors: number;
};

export type SeedRunResult = {
  log_id: number;
  total_scraped: number;
  total_normalized: number;
  total_inserted: number;
  total_skipped: number;
  total_errors: number;
  per_source: Record<SeedSource, SourceStats>;
  duration_ms: number;
};

export type SeedErrorEntry = {
  source: SeedSource;
  url: string;
  error: string;
};

// Credential codes the normalizer is allowed to emit. Mirrors the trucking
// seed in migration 0007 — keep in sync if new codes are added there.
export const SEED_CREDENTIAL_CODES = [
  "CDL_CLASS_A",
  "CDL_CLASS_B",
  "CDL_CLASS_C",
  "END_HAZMAT",
  "END_TANKER",
  "END_DOUBLES",
  "END_PASSENGER",
  "END_SCHOOL_BUS",
  "TWIC",
  "MED_CERT_2YR",
  "HAZMAT_TRAINING",
  "CLEAN_MVR",
] as const;
export type SeedCredentialCode = (typeof SEED_CREDENTIAL_CODES)[number];

export function emptySourceStats(): SourceStats {
  return { scraped: 0, normalized: 0, inserted: 0, skipped: 0, errors: 0 };
}

export function emptyPerSourceStats(): Record<SeedSource, SourceStats> {
  return {
    indeed: emptySourceStats(),
    dat: emptySourceStats(),
    truckingtruth: emptySourceStats(),
    workday: emptySourceStats(),
    company: emptySourceStats(),
  };
}
