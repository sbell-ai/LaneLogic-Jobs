// Sprint 7 — DAT job board HTML scraper. Cheerio (no JS rendering needed).
//
// DAT's listing markup will drift; every selector is wrapped in try/catch and
// an empty result is logged rather than thrown so one selector break doesn't
// abort a run.

import * as cheerio from "cheerio";

import type { ScrapedJobRaw } from "../../../shared/seedTypes";

const BASE = "https://www.dat.com/jobs";
const MAX_PAGES = 5;
const USER_AGENT = "LaneLogics-SeedAgent/1.0 (+https://lanelogics.com)";

async function fetchPage(pageNum: number): Promise<string | null> {
  const url = pageNum === 1 ? BASE : `${BASE}?page=${pageNum}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) {
      console.warn(`[scraper:dat] HTTP ${res.status} on page ${pageNum}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`[scraper:dat] page ${pageNum} fetch failed:`, err);
    return null;
  }
}

function parsePage(html: string): ScrapedJobRaw[] {
  const out: ScrapedJobRaw[] = [];
  try {
    const $ = cheerio.load(html);
    // Defensive selector hierarchy — try several common card classes.
    const cards = $(".job-listing, .job-card, [data-job-id], article.job");
    cards.each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find(".job-title, h2, h3").first().text().trim();
        const company = $el.find(".company, .employer-name").first().text().trim();
        const location = $el.find(".location, .job-location").first().text().trim();
        const description = $el.find(".description, .snippet, .job-summary").first().text().trim();
        const link = $el.find("a").first().attr("href") ?? "";
        const sourceUrl = link.startsWith("http") ? link : link ? `https://www.dat.com${link}` : "";
        if (!title || !sourceUrl) return;
        out.push({
          source: "dat",
          source_url: sourceUrl,
          raw_title: title,
          raw_company: company,
          raw_location: location,
          raw_description: description,
          scraped_at: new Date().toISOString(),
        });
      } catch (cardErr) {
        console.warn("[scraper:dat] card parse error:", cardErr);
      }
    });
  } catch (err) {
    console.warn("[scraper:dat] cheerio load failed:", err);
  }
  return out;
}

export async function runDatScraper(): Promise<ScrapedJobRaw[]> {
  const all: ScrapedJobRaw[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const html = await fetchPage(page);
    if (!html) break;
    const parsed = parsePage(html);
    if (parsed.length === 0) {
      // Either we ran past the last page or the selector is broken — either
      // way, no point fetching more.
      break;
    }
    for (const job of parsed) {
      if (seen.has(job.source_url)) continue;
      seen.add(job.source_url);
      all.push(job);
    }
  }
  console.log(`[scraper:dat] returned ${all.length} postings`);
  return all;
}
