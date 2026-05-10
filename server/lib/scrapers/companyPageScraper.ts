// Sprint 7 — Generic company career-page scraper.
//
// COMPANY_TARGETS is a JSON array of {name, url, selector} objects. We use
// Playwright unconditionally — most modern career sites are SPA-rendered, and
// the cost of a chromium boot is paid once per run regardless. The CSS
// selector tells us which DOM nodes are job cards on each site; we extract
// title, location, and description from each card with best-effort heuristics.

import { chromium, type Browser, type Page } from "playwright";

import type { ScrapedJobRaw } from "../../../shared/seedTypes";

const PAGE_TIMEOUT_MS = 15_000;

type CompanyTarget = { name: string; url: string; selector: string };

function parseTargets(): CompanyTarget[] {
  const raw = process.env.COMPANY_TARGETS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is CompanyTarget =>
        t &&
        typeof t.name === "string" &&
        typeof t.url === "string" &&
        typeof t.selector === "string",
    );
  } catch (err) {
    console.warn("[scraper:company] COMPANY_TARGETS is not valid JSON:", err);
    return [];
  }
}

async function scrapeOne(page: Page, target: CompanyTarget): Promise<ScrapedJobRaw[]> {
  const out: ScrapedJobRaw[] = [];
  try {
    await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });
    await page.waitForSelector(target.selector, { timeout: PAGE_TIMEOUT_MS });
    const cards = await page.$$(target.selector);
    for (const card of cards) {
      try {
        const title =
          (await card.$eval("h1, h2, h3, .title, .job-title", (el) => el.textContent ?? "").catch(
            () => "",
          ))?.trim() ?? "";
        const location =
          (await card
            .$eval(".location, .job-location, [data-location]", (el) => el.textContent ?? "")
            .catch(() => ""))?.trim() ?? "";
        const description = ((await card.textContent()) ?? "").trim();
        const link =
          (await card.$eval("a", (el) => (el as HTMLAnchorElement).href).catch(() => "")) ?? "";
        const sourceUrl = link
          ? link.startsWith("http")
            ? link
            : new URL(link, target.url).toString()
          : target.url;
        if (!title) continue;
        out.push({
          source: "company",
          source_url: sourceUrl,
          raw_title: title,
          raw_company: target.name,
          raw_location: location,
          raw_description: description,
          scraped_at: new Date().toISOString(),
        });
      } catch (cardErr) {
        console.warn(`[scraper:company] card parse failed at ${target.url}:`, cardErr);
      }
    }
  } catch (err) {
    console.warn(`[scraper:company] target ${target.url} failed:`, err);
  }
  return out;
}

export async function runCompanyPageScraper(): Promise<ScrapedJobRaw[]> {
  const targets = parseTargets();
  if (targets.length === 0) {
    console.warn("[scraper:company] COMPANY_TARGETS not set — skipping");
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
    console.warn("[scraper:company] browser launch failed:", err);
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }

  console.log(
    `[scraper:company] returned ${all.length} postings across ${targets.length} targets`,
  );
  return all;
}
