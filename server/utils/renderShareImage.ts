import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { readFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

export const TEMPLATE_VERSION = 1;

const interRegular = readFileSync(join(process.cwd(), "server/fonts/Inter-Regular.woff"));
const interBold = readFileSync(join(process.cwd(), "server/fonts/Inter-Bold.woff"));

interface CacheEntry {
  buffer: Buffer;
  createdAt: number;
}

const MAX_CACHE_SIZE = 200;
const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function evictExpired() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.createdAt > CACHE_TTL_MS) {
      cache.delete(key);
    }
  }
}

function evictOldest() {
  if (cache.size <= MAX_CACHE_SIZE) return;
  const oldest = [...cache.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt);
  while (cache.size > MAX_CACHE_SIZE && oldest.length > 0) {
    const entry = oldest.shift();
    if (entry) cache.delete(entry[0]);
  }
}

export function getJobContentHash(job: {
  title: string;
  companyName?: string | null;
  locationCity?: string | null;
  locationState?: string | null;
  locationCountry?: string | null;
  jobType?: string | null;
  salary?: string | null;
}): string {
  const content = [
    job.title,
    job.companyName || "",
    job.locationCity || "",
    job.locationState || "",
    job.locationCountry || "",
    job.jobType || "",
    job.salary || "",
  ].join("|");
  return createHash("md5").update(content).digest("hex").slice(0, 12);
}

export function getCacheKey(jobId: number, contentHash: string, variant: string): string {
  return `${jobId}:${contentHash}:${variant}:v${TEMPLATE_VERSION}`;
}

export async function renderShareImage(
  template: any,
  width: number,
  height: number,
  cacheKey: string
): Promise<Buffer> {
  evictExpired();

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return cached.buffer;
  }

  const svg = await satori(template, {
    width,
    height,
    fonts: [
      {
        name: "Inter",
        data: interRegular,
        weight: 400,
        style: "normal" as const,
      },
      {
        name: "Inter",
        data: interBold,
        weight: 700,
        style: "normal" as const,
      },
    ],
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width" as const, value: width },
  });
  const pngData = resvg.render();
  const buffer = Buffer.from(pngData.asPng());

  cache.set(cacheKey, { buffer, createdAt: Date.now() });
  evictOldest();

  return buffer;
}
