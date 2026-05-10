// Sprint 7 — Indeed scraper using the Publisher API (not HTML scraping).
//
// Indeed's HTML is heavily fingerprinted and Cloudflare-gated; the Publisher
// API is the sanctioned route. Without a publisher ID we degrade to no-op so
// the orchestrator can keep walking the other sources.

import type { ScrapedJobRaw } from "../../../shared/seedTypes";

const ENDPOINT = "https://apis.indeed.com/ads/apisearch";
const QUERIES = [
  "CDL Class A driver",
  "truck driver CDL",
  "OTR driver",
  "flatbed driver CDL",
];
const RESULT_LIMIT_PER_QUERY = 25;

type IndeedJob = {
  jobtitle?: string;
  company?: string;
  formattedLocation?: string;
  snippet?: string;
  url?: string;
  jobkey?: string;
  date?: string;
};

type IndeedResponse = {
  results?: IndeedJob[];
};

export async function runIndeedScraper(): Promise<ScrapedJobRaw[]> {
  const publisherId = process.env.INDEED_PUBLISHER_ID;
  console.log(
    `[scraper:indeed] env INDEED_PUBLISHER_ID present: ${publisherId ? "yes" : "no"}`,
  );
  if (!publisherId) {
    console.warn("[scraper:indeed] INDEED_PUBLISHER_ID not set — skipping");
    return [];
  }

  const out: ScrapedJobRaw[] = [];
  const seen = new Set<string>();

  for (const q of QUERIES) {
    const url = new URL(ENDPOINT);
    url.searchParams.set("publisher", publisherId);
    url.searchParams.set("q", q);
    url.searchParams.set("co", "us");
    url.searchParams.set("limit", String(RESULT_LIMIT_PER_QUERY));
    url.searchParams.set("v", "2");
    url.searchParams.set("format", "json");

    try {
      const res = await fetch(url.toString());
      const rawText = await res.text();
      console.log(
        `[scraper:indeed] query="${q}" status=${res.status} body=${rawText.length}B`,
      );
      if (!res.ok) {
        console.warn(`[scraper:indeed] HTTP ${res.status} for query "${q}"`);
        continue;
      }
      let body: IndeedResponse;
      try {
        body = JSON.parse(rawText) as IndeedResponse;
      } catch (parseErr) {
        console.warn(
          `[scraper:indeed] non-JSON response for query "${q}":`,
          rawText.slice(0, 200),
        );
        continue;
      }
      const results = Array.isArray(body.results) ? body.results : [];
      for (const j of results) {
        const sourceUrl = j.url ?? "";
        if (!sourceUrl || seen.has(sourceUrl)) continue;
        seen.add(sourceUrl);
        out.push({
          source: "indeed",
          source_url: sourceUrl,
          raw_title: j.jobtitle ?? "",
          raw_company: j.company ?? "",
          raw_location: j.formattedLocation ?? "",
          raw_description: j.snippet ?? "",
          scraped_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn(`[scraper:indeed] query "${q}" failed:`, err);
    }
  }

  console.log(`[scraper:indeed] returned ${out.length} postings`);
  return out;
}
