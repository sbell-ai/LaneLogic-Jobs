import type { TsvRow } from "./tsvParser";
import crypto from "crypto";

export interface MappedJobFields {
  title: string;
  companyName: string;
  description: string;
  sourceUrl: string;
  employmentType: string | null;
  locationCity: string | null;
  locationState: string | null;
  locationCountry: string | null;
  isRemote: boolean | null;
  workLocationType: string | null;
  externalPostedAt: Date | null;
  externalCreatedAt: Date | null;
  externalValidThrough: Date | null;
  sourceDomain: string;
  externalJobId: string;
  employerWebsiteDomain: string | null;
  rawSourceSnippet: string;
}

export function parseBoolean(val: string | undefined | null): boolean | null {
  if (!val || val.trim() === "") return null;
  const lower = val.trim().toLowerCase();
  if (lower === "true" || lower === "1" || lower === "yes") return true;
  if (lower === "false" || lower === "0" || lower === "no") return false;
  return null;
}

export function parseDate(val: string | undefined | null): Date | null {
  if (!val || val.trim() === "") return null;
  const d = new Date(val.trim());
  return isNaN(d.getTime()) ? null : d;
}

const VALID_WORK_LOCATION_TYPES = new Set(["remote", "hybrid", "on_site", "otr", "field_based"]);

export function parseWorkLocationType(explicit: string | undefined | null, remoteDerived: string | undefined | null): string | null {
  if (explicit) {
    const normalized = explicit.trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (VALID_WORK_LOCATION_TYPES.has(normalized)) return normalized;
    if (normalized === "on-site" || normalized === "onsite") return "on_site";
    if (normalized === "field" || normalized === "field-based") return "field_based";
  }
  const isRemote = parseBoolean(remoteDerived);
  if (isRemote === true) return "remote";
  return null;
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function mapTsvRow(row: TsvRow): MappedJobFields | { error: string } {
  const sourceDomain = (row["source_domain"] || "").trim();
  if (!sourceDomain) {
    return { error: "Missing source_domain" };
  }

  const applyUrl = (row["applyUrl"] || "").trim();
  if (!applyUrl || !isValidUrl(applyUrl)) {
    return { error: `Invalid or missing applyUrl: ${applyUrl}` };
  }

  let externalJobId = (row["externalJobKey"] || "").trim();
  if (!externalJobId) {
    externalJobId = crypto.createHash("sha256").update(sourceDomain + applyUrl).digest("hex");
  }

  const title = (row["title"] || "").trim();
  if (!title) {
    return { error: "Missing title" };
  }

  const rawSnippet = JSON.stringify(row);
  const rawSourceSnippet = rawSnippet.length > 2048 ? rawSnippet.substring(0, 2048) : rawSnippet;

  return {
    title,
    companyName: (row["companyName"] || sourceDomain).trim(),
    description: (row["description"] || "").trim(),
    sourceUrl: applyUrl,
    employmentType: (row["jobType"] || "").trim() || null,
    locationCity: (row["locationCity"] || "").trim() || null,
    locationState: (row["locationState"] || "").trim() || null,
    locationCountry: (row["locationCountry"] || "").trim() || null,
    isRemote: parseBoolean(row["remote_derived"]),
    workLocationType: parseWorkLocationType(row["workLocationType"], row["remote_derived"]),
    externalPostedAt: parseDate(row["date_posted"]),
    externalCreatedAt: parseDate(row["date_created"]),
    externalValidThrough: parseDate(row["date_validthrough"]),
    sourceDomain,
    externalJobId,
    employerWebsiteDomain: (row["domain_derived"] || "").trim() || null,
    rawSourceSnippet,
  };
}
