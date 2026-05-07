import { Router } from "express";
import { storage } from "../storage";
import { getLiveTaxonomy, setLiveTaxonomy, type TaxonomyData } from "@shared/jobTaxonomy";
import { requireAdminSession } from "../middleware/requireAdminSession.ts";

const router = Router();

// ── Taxonomy API ─────────────────────────────────────────────────────────────

router.get("/api/taxonomy", (_req, res) => {
  res.json(getLiveTaxonomy());
});

router.put("/api/admin/taxonomy", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  const { taxonomy } = req.body as { taxonomy: TaxonomyData };
  if (!taxonomy || typeof taxonomy !== "object" || Array.isArray(taxonomy)) {
    return res.status(400).json({ message: "taxonomy must be an object" });
  }
  for (const [industry, cats] of Object.entries(taxonomy)) {
    if (typeof industry !== "string" || typeof cats !== "object" || Array.isArray(cats) || cats === null) {
      return res.status(400).json({ message: "Each industry must map to an object of categories" });
    }
    for (const [cat, labels] of Object.entries(cats as Record<string, unknown>)) {
      if (typeof cat !== "string" || !Array.isArray(labels) || (labels as unknown[]).some(s => typeof s !== "string")) {
        return res.status(400).json({ message: "Each category must map to an array of label strings" });
      }
    }
  }
  try {
    const current = await storage.getSiteSettings();
    await storage.updateSiteSettings({ ...(current as any), job_taxonomy: taxonomy });
    setLiveTaxonomy(taxonomy);
    const catCount = Object.values(taxonomy).reduce((n, cats) => n + Object.keys(cats).length, 0);
    res.json({ ok: true, industryCount: Object.keys(taxonomy).length, categoryCount: catCount });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
