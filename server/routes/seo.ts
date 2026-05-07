import { Router } from "express";
import { storage } from "../storage";
import { JOB_CATEGORIES, US_STATES as SEO_STATES } from "@shared/seoConfig";

const router = Router();

// Sitemap
router.get("/robots.txt", (_req, res) => {
  const canonicalHost = process.env.CANONICAL_HOST || `${_req.protocol}://${_req.get("host")}`;
  const privateDisallows = [
    "Disallow: /admin/",
    "Disallow: /api/",
    "Disallow: /dashboard/",
    "Disallow: /login",
    "Disallow: /register",
  ];
  const lines = [
    "User-agent: *",
    "Allow: /",
    ...privateDisallows,
    "",
    "User-agent: GPTBot",
    "Allow: /",
    ...privateDisallows,
    "",
    "User-agent: ChatGPT-User",
    "Allow: /",
    ...privateDisallows,
    "",
    "User-agent: ClaudeBot",
    "Allow: /",
    ...privateDisallows,
    "",
    `Sitemap: ${canonicalHost}/sitemap.xml`,
  ];
  res.set("Content-Type", "text/plain");
  res.send(lines.join("\n"));
});

router.get("/sitemap.xml", async (_req, res) => {
  const canonicalHost = process.env.CANONICAL_HOST || `${_req.protocol}://${_req.get("host")}`;
  const now = new Date().toISOString().split("T")[0];

  const staticPages = ["/", "/jobs", "/blog", "/resources", "/pricing", "/contact", "/employers"];
  let urls = staticPages.map(
    (p) => `  <url><loc>${canonicalHost}${p}</loc><changefreq>weekly</changefreq><priority>${p === "/" ? "1.0" : "0.8"}</priority></url>`
  );

  for (const cat of JOB_CATEGORIES) {
    for (const state of Object.keys(SEO_STATES)) {
      urls.push(`  <url><loc>${canonicalHost}/jobs/${cat.slug}-jobs-${state}</loc><changefreq>daily</changefreq><priority>0.7</priority></url>`);
    }
  }

  try {
    const allJobs = await storage.getJobs();
    const publishedJobs = allJobs.filter((j) => j.isPublished && (!j.expiresAt || new Date(j.expiresAt) > new Date()));
    for (const job of publishedJobs) {
      const lastmod = job.publishedAt ? new Date(job.publishedAt).toISOString().split("T")[0] : now;
      urls.push(`  <url><loc>${canonicalHost}/jobs/${job.id}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>`);
    }

    const allBlogs = await storage.getBlogPosts();
    const publishedBlogs = allBlogs.filter((b) => b.isPublished);
    for (const blog of publishedBlogs) {
      const blogSlug = blog.slug || String(blog.id);
      const lastmod = blog.updatedAt
        ? new Date(blog.updatedAt).toISOString().split("T")[0]
        : blog.publishedAt ? new Date(blog.publishedAt).toISOString().split("T")[0] : now;
      urls.push(`  <url><loc>${canonicalHost}/blog/${blogSlug}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`);
    }

    const allPages = await storage.getPages();
    const publishedPages = allPages.filter((p) => p.isPublished && p.slug);
    for (const page of publishedPages) {
      const lastmod = page.updatedAt ? new Date(page.updatedAt).toISOString().split("T")[0] : now;
      urls.push(`  <url><loc>${canonicalHost}/pages/${page.slug}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.5</priority></url>`);
    }
  } catch (err) {
    console.error("[sitemap] Error fetching dynamic entities:", err);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  res.set("Content-Type", "application/xml");
  res.set("Cache-Control", "public, max-age=3600");
  res.send(xml);
});

router.get("/llms.txt", (_req, res) => {
  const canonicalHost = process.env.CANONICAL_HOST || `${_req.protocol}://${_req.get("host")}`;
  const lines = [
    "# LaneLogic Jobs",
    "",
    "> LaneLogic Jobs is a search-first job board for the transportation and logistics industry.",
    "> It connects job seekers with CDL driver, warehouse, freight, and supply chain roles across the United States.",
    "",
    "## Key pages",
    "",
    `- Job search: ${canonicalHost}/`,
    `- All jobs: ${canonicalHost}/jobs`,
    `- Employer directory: ${canonicalHost}/employers`,
    `- Blog: ${canonicalHost}/blog`,
    `- Resources: ${canonicalHost}/resources`,
    `- Pricing: ${canonicalHost}/pricing`,
    `- Contact: ${canonicalHost}/contact`,
    "",
    "## About",
    "",
    "LaneLogic Jobs is the niche job board for transportation and logistics professionals.",
    "Free for job seekers. Employers can post jobs, manage applications, and promote openings.",
    "",
    "## Sitemap",
    "",
    `${canonicalHost}/sitemap.xml`,
  ];
  res.set("Content-Type", "text/plain");
  res.send(lines.join("\n"));
});

export default router;
