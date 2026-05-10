// Sprint 7 — Generic Greenhouse multi-board scraper.
//
// Replaces the now-defunct truckingtruth source. Greenhouse hosts public
// job boards for many freight/logistics employers; a single API call per
// board returns structured records (title, location, full description,
// canonical URL) so we get reliability and zero selector drift.
//
// Two boards are baked in as defaults: uberfreight and flexport — both
// core freight/logistics. Operators can override or extend the list via
// the GREENHOUSE_BOARDS env var:
//
//   GREENHOUSE_BOARDS=["uberfreight","flexport","samsara"]
//
// Either form is accepted:
//   ["token1","token2"]                      // bare tokens; name fetched from API
//   [{"token":"uberfreight","name":"Uber Freight"}]   // explicit override

import * as cheerio from "cheerio";

import type { ScrapedJobRaw } from "../../../shared/seedTypes";
import { isUSLocation } from "../seedFilters";

const DEFAULT_BOARDS: GreenhouseBoard[] = [
  { token: "uberfreight", name: "Uber Freight" },
  { token: "flexport", name: "Flexport" },
];

type GreenhouseBoard = {
  token: string;
  name?: string;
};

type GreenhouseJob = {
  id: number;
  title: string;
  absolute_url: string;
  company_name?: string | null;
  content?: string;
  location?: { name?: string };
  updated_at?: string;
  first_published?: string;
};

type GreenhouseResponse = {
  jobs?: GreenhouseJob[];
};

function parseBoards(): GreenhouseBoard[] {
  const raw = process.env.GREENHOUSE_BOARDS;
  console.log(
    `[scraper:greenhouse] env GREENHOUSE_BOARDS present: ${raw ? "yes" : "no"}` +
      (raw ? `, length=${raw.length}B` : ""),
  );
  if (!raw) {
    console.log(
      `[scraper:greenhouse] using ${DEFAULT_BOARDS.length} default board(s): ${DEFAULT_BOARDS.map((b) => b.token).join(", ")}`,
    );
    return DEFAULT_BOARDS;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn(
        `[scraper:greenhouse] GREENHOUSE_BOARDS parsed but is not an array: ${typeof parsed}`,
      );
      return DEFAULT_BOARDS;
    }
    const valid: GreenhouseBoard[] = [];
    for (const entry of parsed) {
      if (typeof entry === "string" && entry.trim()) {
        valid.push({ token: entry.trim() });
      } else if (
        entry &&
        typeof entry === "object" &&
        typeof (entry as any).token === "string"
      ) {
        valid.push({
          token: (entry as any).token.trim(),
          name: typeof (entry as any).name === "string" ? (entry as any).name : undefined,
        });
      }
    }
    console.log(
      `[scraper:greenhouse] GREENHOUSE_BOARDS parsed: ${parsed.length} entries, ${valid.length} valid`,
    );
    console.log(
      `[scraper:greenhouse] parsed boards: ${JSON.stringify(valid)}`,
    );
    return valid.length > 0 ? valid : DEFAULT_BOARDS;
  } catch (err) {
    console.warn("[scraper:greenhouse] GREENHOUSE_BOARDS is not valid JSON:", err);
    return DEFAULT_BOARDS;
  }
}

function htmlToText(html: string): string {
  if (!html) return "";
  try {
    return cheerio.load(html).text().replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  } catch {
    return html.replace(/<[^>]+>/g, " ").trim();
  }
}

async function scrapeBoard(board: GreenhouseBoard): Promise<ScrapedJobRaw[]> {
  const out: ScrapedJobRaw[] = [];
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board.token)}/jobs?content=true`;
  try {
    const res = await fetch(url);
    const rawText = res.ok ? await res.text() : "";
    console.log(
      `[scraper:greenhouse] board=${board.token} url=${url} status=${res.status} body=${rawText.length}B`,
    );
    if (!res.ok) {
      console.warn(`[scraper:greenhouse] HTTP ${res.status} for board "${board.token}"`);
      return [];
    }
    let body: GreenhouseResponse;
    try {
      body = JSON.parse(rawText) as GreenhouseResponse;
    } catch (parseErr) {
      console.warn(
        `[scraper:greenhouse] non-JSON for board "${board.token}":`,
        rawText.slice(0, 200),
      );
      return [];
    }
    const jobs = Array.isArray(body.jobs) ? body.jobs : [];
    console.log(
      `[scraper:greenhouse] board=${board.token} returned ${jobs.length} job(s)`,
    );
    const fallbackName = board.name ?? board.token;
    let droppedNonUS = 0;
    for (const j of jobs) {
      const sourceUrl = j.absolute_url ?? "";
      if (!sourceUrl) continue;
      const locName = j.location?.name ?? "";
      if (!isUSLocation(locName)) {
        droppedNonUS++;
        continue;
      }
      out.push({
        source: "greenhouse",
        source_url: sourceUrl,
        raw_title: j.title ?? "",
        raw_company: (j.company_name?.trim() || fallbackName).trim(),
        raw_location: locName,
        raw_description: htmlToText(j.content ?? ""),
        raw_posted_at: j.first_published ?? j.updated_at,
        scraped_at: new Date().toISOString(),
      });
    }
    if (droppedNonUS > 0) {
      console.log(
        `[scraper:greenhouse] board=${board.token} dropped ${droppedNonUS} non-US posting(s)`,
      );
    }
  } catch (err) {
    console.warn(`[scraper:greenhouse] board "${board.token}" failed:`, err);
  }
  return out;
}

export async function runGreenhouseScraper(): Promise<ScrapedJobRaw[]> {
  console.log(`[scraper:greenhouse] starting`);
  const boards = parseBoards();
  if (boards.length === 0) {
    console.warn("[scraper:greenhouse] no boards configured — skipping");
    return [];
  }

  const all: ScrapedJobRaw[] = [];
  const seen = new Set<string>();
  for (const board of boards) {
    const results = await scrapeBoard(board);
    for (const job of results) {
      if (seen.has(job.source_url)) continue;
      seen.add(job.source_url);
      all.push(job);
    }
  }
  console.log(
    `[scraper:greenhouse] returned ${all.length} postings across ${boards.length} board(s)`,
  );
  return all;
}
