// Sprint 7 — DAT scraper using the Greenhouse public Job Board API.
//
// DAT's old /jobs HTML page is now a Vue SPA backed by Greenhouse's public
// boards API (board token "datsolutions"). Hitting the API directly gives us
// structured records (no selector drift, no JS rendering) and full job
// descriptions in one call.
//
// API: https://boards-api.greenhouse.io/v1/boards/datsolutions/jobs?content=true
// Docs: https://developers.greenhouse.io/job-board.html

import * as cheerio from "cheerio";

import type { ScrapedJobRaw } from "../../../shared/seedTypes";
import { isUSLocation } from "../seedFilters";

const GREENHOUSE_BOARD = "datsolutions";
const ENDPOINT = `https://boards-api.greenhouse.io/v1/boards/${GREENHOUSE_BOARD}/jobs?content=true`;
const COMPANY_FALLBACK = "DAT Freight & Analytics";

type GreenhouseJob = {
  id: number;
  title: string;
  absolute_url: string;
  company_name?: string | null;
  content?: string;
  location?: { name?: string };
  updated_at?: string;
};

type GreenhouseResponse = {
  jobs?: GreenhouseJob[];
};

// Greenhouse returns description as HTML-encoded markup. The normalizer
// expects plain text — cheerio strips tags and decodes entities cleanly.
function htmlToText(html: string): string {
  if (!html) return "";
  try {
    return cheerio.load(html).text().replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  } catch {
    return html.replace(/<[^>]+>/g, " ").trim();
  }
}

export async function runDatScraper(): Promise<ScrapedJobRaw[]> {
  console.log(`[scraper:dat] starting (Greenhouse API, board=${GREENHOUSE_BOARD})`);
  const out: ScrapedJobRaw[] = [];
  const seen = new Set<string>();

  try {
    const res = await fetch(ENDPOINT);
    const rawText = res.ok ? await res.text() : "";
    console.log(
      `[scraper:dat] url=${ENDPOINT} status=${res.status} body=${rawText.length}B`,
    );
    if (!res.ok) {
      console.warn(`[scraper:dat] HTTP ${res.status} from Greenhouse API`);
      return [];
    }

    let body: GreenhouseResponse;
    try {
      body = JSON.parse(rawText) as GreenhouseResponse;
    } catch (parseErr) {
      console.warn(
        `[scraper:dat] non-JSON response:`,
        rawText.slice(0, 200),
        parseErr,
      );
      return [];
    }

    const jobs = Array.isArray(body.jobs) ? body.jobs : [];
    console.log(`[scraper:dat] API returned ${jobs.length} job(s)`);

    let droppedNonUS = 0;
    for (const j of jobs) {
      const sourceUrl = j.absolute_url ?? "";
      if (!sourceUrl || seen.has(sourceUrl)) continue;
      seen.add(sourceUrl);
      const locName = j.location?.name ?? "";
      if (!isUSLocation(locName)) {
        droppedNonUS++;
        continue;
      }
      out.push({
        source: "dat",
        source_url: sourceUrl,
        raw_title: j.title ?? "",
        raw_company: j.company_name?.trim() || COMPANY_FALLBACK,
        raw_location: locName,
        raw_description: htmlToText(j.content ?? ""),
        scraped_at: new Date().toISOString(),
      });
    }
    if (droppedNonUS > 0) {
      console.log(`[scraper:dat] dropped ${droppedNonUS} non-US posting(s)`);
    }
  } catch (err) {
    console.warn("[scraper:dat] fetch failed:", err);
  }

  console.log(`[scraper:dat] returned ${out.length} postings`);
  return out;
}
