// Sprint 7 — Workday-hosted career page scraper. Playwright (chromium).
//
// Workday SPAs don't render job lists server-side, so cheerio won't see them.
// We accept a list of career-page URLs in WORKDAY_TARGETS (JSON array) and
// drive a headless browser through each. --no-sandbox is required in Replit.
//
// Per-page timeout: 15s. A timeout on one target doesn't abort the run.

import { chromium, type Browser, type Page } from "playwright";

import type { ScrapedJobRaw } from "../../../shared/seedTypes";

const PAGE_TIMEOUT_MS = 15_000;

type WorkdayTarget = { url: string; name: string };

function parseTargets(): WorkdayTarget[] {
  const raw = process.env.WORKDAY_TARGETS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is WorkdayTarget =>
        t && typeof t.url === "string" && typeof t.name === "string",
    );
  } catch (err) {
    console.warn("[scraper:workday] WORKDAY_TARGETS is not valid JSON:", err);
    return [];
  }
}

async function scrapeOne(
  page: Page,
  target: WorkdayTarget,
): Promise<ScrapedJobRaw[]> {
  const out: ScrapedJobRaw[] = [];
  try {
    await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });
    // Workday uses data-automation-id attributes; the job-list container is
    // the most stable anchor we have across tenants.
    await page.waitForSelector('[data-automation-id="jobResults"], li.css-1q2dra3, [data-automation-id="jobTitle"]', {
      timeout: PAGE_TIMEOUT_MS,
    });

    const cards = await page.$$('[data-automation-id="jobResults"] li, li.css-1q2dra3');
    for (const card of cards) {
      try {
        const titleEl = await card.$('[data-automation-id="jobTitle"], a');
        const title = (await titleEl?.textContent())?.trim() ?? "";
        const href = (await titleEl?.getAttribute("href")) ?? "";
        const sourceUrl = href.startsWith("http")
          ? href
          : href
          ? new URL(href, target.url).toString()
          : "";
        const locationEl = await card.$('[data-automation-id="locations"], [data-automation-id="location"]');
        const location = (await locationEl?.textContent())?.trim() ?? "";
        const description = (await card.textContent())?.trim() ?? "";
        if (!title || !sourceUrl) continue;
        out.push({
          source: "workday",
          source_url: sourceUrl,
          raw_title: title,
          raw_company: target.name,
          raw_location: location,
          raw_description: description,
          scraped_at: new Date().toISOString(),
        });
      } catch (cardErr) {
        console.warn(`[scraper:workday] card parse failed at ${target.url}:`, cardErr);
      }
    }
  } catch (err) {
    console.warn(`[scraper:workday] target ${target.url} failed:`, err);
  }
  return out;
}

export async function runWorkdayScraper(): Promise<ScrapedJobRaw[]> {
  const targets = parseTargets();
  if (targets.length === 0) {
    console.warn("[scraper:workday] WORKDAY_TARGETS not set — skipping");
    return [];
  }

  let browser: Browser | null = null;
  const all: ScrapedJobRaw[] = [];
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const ctx = await browser.newContext({
      userAgent: "LaneLogics-SeedAgent/1.0 (+https://lanelogics.com)",
    });
    const page = await ctx.newPage();
    for (const target of targets) {
      const results = await scrapeOne(page, target);
      all.push(...results);
    }
    await ctx.close();
  } catch (err) {
    console.warn("[scraper:workday] browser launch failed:", err);
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }

  console.log(`[scraper:workday] returned ${all.length} postings across ${targets.length} targets`);
  return all;
}
