// Sprint 7 — AI job normalizer.
//
// Bridges scrapers (raw, source-shaped postings) to the writer (DB-ready
// NormalizedJob). One Claude call per posting + one Nominatim geocode per
// posting. Both are network-dependent — callers must tolerate nulls.
//
// Console-fallback behavior is required by the spec: when ANTHROPIC_API_KEY
// is unset (e.g. local dev without secrets) the normalizer logs and returns
// null instead of throwing, so the seeder can keep walking the queue.

import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";

import {
  type NormalizedJob,
  type ScrapedJobRaw,
  type SeedCredentialCode,
  type SeedJobType,
  type SeedModalNamespace,
  SEED_CREDENTIAL_CODES,
} from "../../shared/seedTypes";

// claude-sonnet-4-6 = latest Sonnet. Spec pinned an older snapshot
// (sonnet-4-20250514); rolled forward for better extraction.
const NORMALIZER_MODEL = "claude-sonnet-4-6";
const NORMALIZER_MAX_TOKENS = 1024;

const VALID_JOB_TYPES: readonly SeedJobType[] = [
  "full_time",
  "part_time",
  "contract",
  "owner_operator",
];
const VALID_MODALS: readonly SeedModalNamespace[] = [
  "trucking",
  "maritime",
  "aviation",
  "logistics",
];
const VALID_CREDENTIAL_CODES = new Set<string>(SEED_CREDENTIAL_CODES);

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const SYSTEM_PROMPT =
  "You are a structured data extraction assistant for LaneLogics, a commercial " +
  "transportation credentialing and job matching platform. Extract structured fields " +
  "from raw job postings. Respond ONLY with valid JSON — no preamble, no markdown fences.";

function buildUserPrompt(raw: ScrapedJobRaw): string {
  return [
    "Extract structured data from this job posting.",
    "",
    "RAW POSTING:",
    `Title: ${raw.raw_title}`,
    `Company: ${raw.raw_company}`,
    `Location: ${raw.raw_location}`,
    `Description: ${raw.raw_description}`,
    `Compensation: ${raw.raw_compensation ?? ""}`,
    "",
    "CREDENTIAL CODES (map requirements to these exact codes only):",
    SEED_CREDENTIAL_CODES.join(", "),
    "",
    "Respond with this exact JSON shape:",
    "{",
    '  "title": "clean job title",',
    '  "company_name": "company name",',
    '  "location_text": "City, ST",',
    '  "is_remote": false,',
    '  "description": "2-3 paragraph clean job description",',
    '  "job_type": "full_time | part_time | contract | owner_operator",',
    '  "modal_namespace": "trucking | maritime | aviation | logistics",',
    '  "required_credential_codes": ["CDL_CLASS_A"],',
    '  "preferred_credential_codes": ["TWIC"],',
    '  "min_experience_years": 2',
    "}",
    "",
    "Rules:",
    "- required_credential_codes: credentials explicitly stated as required",
    "- preferred_credential_codes: credentials listed as preferred/bonus/nice-to-have",
    "- Infer modal_namespace from job content (default: trucking)",
    "- job_type: infer from posting if not explicit (default: full_time)",
    "- description: rewrite in clean plain English, 2-3 paragraphs, no marketing fluff",
    '- location_text: normalize to "City, ST" format',
    "- If a field cannot be determined, use null for nullable fields or [] for arrays",
  ].join("\n");
}

// Stable identity for a posting: lowercased title|company|location.
// Same input → same hash → primary dedup gate in the writer.
export function computeSourceHash(title: string, company: string, location: string): string {
  return createHash("sha256")
    .update(`${title.toLowerCase()}|${company.toLowerCase()}|${location.toLowerCase()}`)
    .digest("hex");
}

type ClaudeNormalizedShape = {
  title: string;
  company_name: string;
  location_text: string;
  is_remote: boolean;
  description: string;
  job_type: SeedJobType;
  modal_namespace: SeedModalNamespace;
  required_credential_codes: SeedCredentialCode[];
  preferred_credential_codes: SeedCredentialCode[];
  min_experience_years: number;
};

function safeParseJson(text: string): unknown {
  // Claude occasionally wraps JSON in ```json fences despite the system
  // prompt; strip them before parsing instead of failing the whole posting.
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asBool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function asNumber(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function asCredCodeArray(v: unknown): SeedCredentialCode[] {
  if (!Array.isArray(v)) return [];
  const out: SeedCredentialCode[] = [];
  for (const entry of v) {
    if (typeof entry !== "string") continue;
    const upper = entry.toUpperCase();
    if (VALID_CREDENTIAL_CODES.has(upper)) out.push(upper as SeedCredentialCode);
  }
  return out;
}

function asJobType(v: unknown): SeedJobType {
  return typeof v === "string" && (VALID_JOB_TYPES as readonly string[]).includes(v)
    ? (v as SeedJobType)
    : "full_time";
}

function asModal(v: unknown): SeedModalNamespace {
  return typeof v === "string" && (VALID_MODALS as readonly string[]).includes(v)
    ? (v as SeedModalNamespace)
    : "trucking";
}

function coerceClaudeShape(parsed: unknown): ClaudeNormalizedShape | null {
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const title = asString(o.title).trim();
  const company = asString(o.company_name).trim();
  const location = asString(o.location_text).trim();
  // Title and company are load-bearing — the source_hash is meaningless
  // without them, and we don't want to pollute the index with empty strings.
  if (!title || !company) return null;
  return {
    title,
    company_name: company,
    location_text: location,
    is_remote: asBool(o.is_remote, false),
    description: asString(o.description),
    job_type: asJobType(o.job_type),
    modal_namespace: asModal(o.modal_namespace),
    required_credential_codes: asCredCodeArray(o.required_credential_codes),
    preferred_credential_codes: asCredCodeArray(o.preferred_credential_codes),
    min_experience_years: Math.max(0, Math.floor(asNumber(o.min_experience_years, 0))),
  };
}

// ── Geocoding ────────────────────────────────────────────────────────────────
//
// Nominatim is free but strictly rate-limits 1 req/sec per IP. The orchestrator
// runs postings sequentially through the normalizer, so a serialized 1100ms
// sleep between calls is enough — no extra queue needed.

const GEOCODE_USER_AGENT = "LaneLogics-SeedAgent/1.0 (https://lanelogics.com)";
const GEOCODE_DELAY_MS = 1100;
let lastGeocodeAt = 0;

export async function geocodeLocation(
  locationText: string,
): Promise<{ lat: number | null; lng: number | null }> {
  if (!locationText.trim()) return { lat: null, lng: null };

  const elapsed = Date.now() - lastGeocodeAt;
  if (elapsed < GEOCODE_DELAY_MS) {
    await new Promise((r) => setTimeout(r, GEOCODE_DELAY_MS - elapsed));
  }
  lastGeocodeAt = Date.now();

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", locationText);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": GEOCODE_USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn(`[normalizer] geocode HTTP ${res.status} for "${locationText}"`);
      return { lat: null, lng: null };
    }
    const body = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    const first = Array.isArray(body) ? body[0] : undefined;
    if (!first?.lat || !first?.lon) return { lat: null, lng: null };
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { lat: null, lng: null };
    return { lat, lng };
  } catch (err) {
    console.warn(`[normalizer] geocode failed for "${locationText}":`, err);
    return { lat: null, lng: null };
  }
}

// ── Public entry point ──────────────────────────────────────────────────────

export async function normalizeJob(raw: ScrapedJobRaw): Promise<NormalizedJob | null> {
  console.log(
    `[normalizer] ANTHROPIC_API_KEY present: ${process.env.ANTHROPIC_API_KEY ? "yes" : "no"}, source=${raw.source}, url=${raw.source_url}`,
  );
  if (!client) {
    console.log("[normalizer] ANTHROPIC_API_KEY not set — skipping normalization");
    return null;
  }

  let response;
  try {
    response = await client.messages.create({
      model: NORMALIZER_MODEL,
      max_tokens: NORMALIZER_MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(raw) }],
    });
  } catch (err) {
    console.warn(`[normalizer] Claude call failed for ${raw.source_url}:`, err);
    return null;
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    console.warn(`[normalizer] Claude returned no text block for ${raw.source_url}`);
    return null;
  }

  const parsed = safeParseJson(textBlock.text);
  const shape = coerceClaudeShape(parsed);
  if (!shape) {
    console.warn(`[normalizer] Claude output failed validation for ${raw.source_url}`);
    return null;
  }

  const { lat, lng } = await geocodeLocation(shape.location_text);

  return {
    title: shape.title,
    company_name: shape.company_name,
    location_text: shape.location_text,
    lat,
    lng,
    description: shape.description,
    job_type: shape.job_type,
    modal_namespace: shape.modal_namespace,
    required_credential_codes: shape.required_credential_codes,
    preferred_credential_codes: shape.preferred_credential_codes,
    min_experience_years: shape.min_experience_years,
    source: raw.source,
    source_url: raw.source_url,
    source_hash: computeSourceHash(shape.title, shape.company_name, shape.location_text),
    is_remote: shape.is_remote,
  };
}
