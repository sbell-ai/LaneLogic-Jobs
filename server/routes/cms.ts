import { Router } from "express";
import { storage } from "../storage";
import { insertPageSchema } from "@shared/schema";
import { requireAdminSession } from "../middleware/requireAdminSession.ts";

const router = Router();

router.get("/api/pages", async (req, res) => {
  const allPages = await storage.getPages();
  if (req.isAuthenticated() && (req.user as any).role === "admin") {
    res.json(allPages);
  } else {
    res.json(allPages.filter(p => p.isPublished));
  }
});

router.get("/api/pages/slug/:slug", async (req, res) => {
  const page = await storage.getPageBySlug(req.params.slug);
  if (!page) return res.status(404).json({ message: "Page not found" });
  if (!page.isPublished) {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(404).json({ message: "Page not found" });
    }
  }
  res.json(page);
});

router.get("/api/pages/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid page ID" });
  const page = await storage.getPage(id);
  if (!page) return res.status(404).json({ message: "Page not found" });
  if (!page.isPublished) {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(404).json({ message: "Page not found" });
    }
  }
  res.json(page);
});

const GUIDE_PAGES: Record<string, string> = {
  "job-seeker": "https://www.notion.so/013835e339c247d680a652935bdbccf8",
  "employer":   "https://www.notion.so/8b9930c2d9914d8d83b9a95445da5b66",
};

router.get("/api/content/notion-guide", async (req, res) => {
  const slug = String(req.query.slug || "");
  const pageUrl = GUIDE_PAGES[slug];
  if (!pageUrl) return res.status(404).json({ message: "Guide not found" });

  try {
    const { pageIdFromUrl, notionGetPage, notionGetAllBlocks } = await import("../notion/client.js");
    const pageId = pageIdFromUrl(pageUrl);

    const [pageRes, allBlocks] = await Promise.all([
      notionGetPage(pageId),
      notionGetAllBlocks(pageId),
    ]);

    const props = (pageRes as any).properties ?? {};
    let title = slug;
    const titleProp = props.title ?? props.Name;
    if (titleProp?.title) {
      title = titleProp.title.map((t: any) => t.plain_text).join("") || slug;
    }

    res.json({ title, blocks: allBlocks });
  } catch (err: any) {
    console.error("[notion-guide]", err?.message ?? err);
    res.status(500).json({ message: "Failed to fetch guide from Notion", detail: err?.message });
  }
});

function sanitizeHtml(html: string): string {
  const allowedTags = new Set([
    "h1","h2","h3","h4","h5","h6","p","br","hr","blockquote",
    "ul","ol","li","a","strong","b","em","i","u","s","del",
    "code","pre","span","div","img","table","thead","tbody","tr","th","td",
    "figure","figcaption","section","article","header","footer","main","nav",
    "sup","sub","mark","small","abbr","details","summary",
  ]);
  const allowedAttrs = new Set(["href","src","alt","title","class","id","target","rel","width","height","colspan","rowspan"]);
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<iframe[^>]*\/?>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[^>]*\/?>/gi, "");
}

router.post("/api/pages", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  const parsed = insertPageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid page data", errors: parsed.error.flatten() });
  }
  try {
    const data = { ...parsed.data, content: sanitizeHtml((parsed.data as any).content) };
    const page = await storage.createPage(data);
    res.json(page);
  } catch (err: any) {
    if (err.message?.includes("unique") || err.code === "23505") {
      return res.status(400).json({ message: "A page with this slug already exists" });
    }
    throw err;
  }
});

router.put("/api/pages/:id", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  const parsed = insertPageSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid page data", errors: parsed.error.flatten() });
  }
  try {
    const data = (parsed.data as any).content !== undefined ? { ...parsed.data, content: sanitizeHtml((parsed.data as any).content) } : parsed.data;
    const page = await storage.updatePage(Number(req.params.id), data);
    if (!page) return res.status(404).json({ message: "Page not found" });
    res.json(page);
  } catch (err: any) {
    if (err.message?.includes("unique") || err.code === "23505") {
      return res.status(400).json({ message: "A page with this slug already exists" });
    }
    throw err;
  }
});

router.delete("/api/pages/:id", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  await storage.deletePage(Number(req.params.id));
  res.json({ message: "Deleted" });
});

export default router;
