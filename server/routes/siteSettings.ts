import { Router } from "express";
import { storage } from "../storage";
import { requireAdminSession } from "../middleware/requireAdminSession.ts";

const router = Router();

// Site Settings
router.get("/api/settings", async (_req, res) => {
  try {
    const settings = await storage.getSiteSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: "Could not load settings" });
  }
});

router.put("/api/settings", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const body = req.body;
    const footerFields = ["footerTextColor", "footerLinkColor", "footerLinkHoverColor", "footerBgColor", "pageBackgroundColor"];
    const hasFooterChange = footerFields.some(f => body[f] !== undefined) || body.footerBgOpacity !== undefined;

    if (hasFooterChange) {
      const { normalizeHex, checkFooterContrast } = await import("@shared/colorUtils");
      const current = await storage.getSiteSettings();
      const merged = { ...current, ...body };

      for (const f of ["footerTextColor", "footerLinkColor", "footerLinkHoverColor", "footerBgColor", "pageBackgroundColor"] as const) {
        if (body[f] !== undefined) {
          if (typeof body[f] !== "string" || body[f].trim() === "") {
            return res.status(400).json({ message: `${f} must be a non-empty hex color string` });
          }
          const normalized = normalizeHex(body[f]);
          if (!normalized) {
            return res.status(400).json({ message: `${f} is not a valid hex color` });
          }
          body[f] = normalized;
          merged[f] = normalized;
        }
      }

      if (merged.footerBgOpacity !== undefined) {
        const op = Number(merged.footerBgOpacity);
        if (isNaN(op) || op < 0 || op > 1) {
          return res.status(400).json({ message: "footerBgOpacity must be between 0 and 1" });
        }
      }

      const checks = checkFooterContrast(
        merged.footerBgColor || "#0b1220",
        merged.footerBgOpacity ?? 1,
        merged.pageBackgroundColor || "#ffffff",
        merged.footerTextColor || "#e5e7eb",
        merged.footerLinkColor || "#93c5fd",
        merged.footerLinkHoverColor || "#bfdbfe",
      );
      const failures = checks.filter(c => !c.passes);
      if (failures.length > 0) {
        return res.status(400).json({
          message: "Contrast check failed",
          errors: failures.map(f => ({
            field: f.field,
            reason: "contrast_failed",
            ratio: f.ratio,
            min: 4.5,
            message: f.message,
          })),
        });
      }
    }

    const settings = await storage.updateSiteSettings(body);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: "Could not save settings" });
  }
});

export default router;
