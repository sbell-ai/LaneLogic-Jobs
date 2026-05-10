// Sprint 7 — Truckingtruth job board scraper. Cheerio.
//
// Same shape as datScraper but a different listing URL and pagination cap.

import * as cheerio from "cheerio";

import type { ScrapedJobRaw } from "../../../shared/seedTypes";

const BASE = "https://www.truckingtruth.com/trucking-jobs";
const MAX_PAGES = 3;
const USER_AGENT = "LaneLogics-SeedAgent/1.0 (+https://lanelogics.com)";

async function fetchPage(pageNum: number): Promise<string | null> {
  const url = pageNum === 1 ? `${BASE}/` : `${BASE}/?page=${pageNum}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) {
      console.warn(`[scraper:truckingtruth] HTTP ${res.status} on page ${pageNum}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`[scraper:truckingtruth] page ${pageNum} fetch failed:`, err);
    return null;
  }
}

function parsePage(html: string): ScrapedJobRaw[] {
  const out: ScrapedJobRaw[] = [];
  try {
    const $ = cheerio.load(html);
    const cards = $(".job-listing, .job-result, article, .listing");
    cards.each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find("h2, h3, .job-title").first().text().trim();
        const company = $el.find(".company, .carrier-name").first().text().trim();
        const location = $el.find(".location, .job-location").first().text().trim();
        const description = $el.find(".description, .summary, p").first().text().trim();
        const link = $el.find("a").first().attr("href") ?? "";
        const sourceUrl = link.startsWith("http")
          ? link
          : link
          ? `https://www.truckingtruth.com${link}`
          : "";
        if (!title || !sourceUrl) return;
        out.push({
          source: "truckingtruth",
          source_url: sourceUrl,
          raw_title: title,
          raw_company: company,
          raw_location: location,
          raw_description: description,
          scraped_at: new Date().toISOString(),
        });
      } catch (cardErr) {
        console.warn("[scraper:truckingtruth] card parse error:", cardErr);
      }
    });
  } catch (err) {
    console.warn("[scraper:truckingtruth] cheerio load failed:", err);
  }
  return out;
}

export async function runTruckingtruthScraper(): Promise<ScrapedJobRaw[]> {
  const all: ScrapedJobRaw[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const html = await fetchPage(page);
    if (!html) break;
    const parsed = parsePage(html);
    if (parsed.length === 0) break;
    for (const job of parsed) {
      if (seen.has(job.source_url)) continue;
      seen.add(job.source_url);
      all.push(job);
    }
  }
  console.log(`[scraper:truckingtruth] returned ${all.length} postings`);
  return all;
}
