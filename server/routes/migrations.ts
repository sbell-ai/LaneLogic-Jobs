import { Router } from "express";
import path from "path";
import { eq } from "drizzle-orm";
import { storage } from "../storage";
import { db } from "../db";
import { jobs } from "@shared/schema";
import { isR2Configured, uploadToR2 } from "../r2";
import { normalizeCategory } from "@shared/jobTaxonomy";
import { requireAdminSession } from "../middleware/requireAdminSession.ts";
import { paragraphize } from "./helpers";

const router = Router();

router.post("/api/admin/jobs/migrate-paragraphize", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const allJobs = await db.select({ id: jobs.id, description: jobs.description }).from(jobs);
    let updated = 0;
    for (const job of allJobs) {
      if (!job.description) continue;
      const newlineCount = (job.description.match(/\n/g) || []).length;
      if (newlineCount >= 2) continue;
      const newDesc = paragraphize(job.description);
      if (newDesc !== job.description) {
        await db.update(jobs).set({ description: newDesc }).where(eq(jobs.id, job.id));
        updated++;
      }
    }
    res.json({ message: `Paragraphized ${updated} job descriptions`, updated });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

const LEGACY_CATEGORY_MAP: Record<string, string | null> = {
  "driver": "Drivers (CDL & Non-CDL)",
  "driving": "Drivers (CDL & Non-CDL)",
  "driving | transport": "Drivers (CDL & Non-CDL)",
  "driving | otr": "Drivers (CDL & Non-CDL)",
  "otr": "Drivers (CDL & Non-CDL)",
  "local": "Drivers (CDL & Non-CDL)",
  "flatbed": "Drivers (CDL & Non-CDL)",
  "tanker | hazmat": "Drivers (CDL & Non-CDL)",
  "owner-operator": "Drivers (CDL & Non-CDL)",
  "dispatch": "Ground Transportation Ops (Dispatch, Planning, Fleet)",
  "dispatcher": "Ground Transportation Ops (Dispatch, Planning, Fleet)",
  "warehouse": "Warehousing & Distribution (DC Ops)",
  "operators": "Warehousing & Distribution (DC Ops)",
  "operations management - district": "Leadership & Management",
  "operations management - frontline": "Leadership & Management",
  "operations support": "Leadership & Management",
  "account management": "Customer Service & Account Management",
  "accounts payable": "Finance, Billing, Claims & Audit",
  "ce inbound sales and service": "Customer Service & Account Management",
  "technicians": null,
  "mechanic": null,
  "intern": null,
  "it project management": null,
  "welding": null,
  "sustainability and environmental services": null,
};

router.post("/api/admin/jobs/migrate-categories", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const allJobs = await db.select({ id: jobs.id, category: jobs.category }).from(jobs);
    let mapped = 0;
    let cleared = 0;
    let unchanged = 0;
    for (const job of allJobs) {
      if (!job.category || job.category.trim() === "") { unchanged++; continue; }
      const normalized = normalizeCategory(job.category);
      if (normalized) {
        if (normalized !== job.category) {
          await db.update(jobs).set({ category: normalized } as any).where(eq(jobs.id, job.id));
          mapped++;
        } else {
          unchanged++;
        }
        continue;
      }
      const legacyMapping = LEGACY_CATEGORY_MAP[job.category.toLowerCase()];
      if (legacyMapping !== undefined) {
        await db.update(jobs).set({ category: legacyMapping } as any).where(eq(jobs.id, job.id));
        if (legacyMapping) mapped++; else cleared++;
      } else {
        await db.update(jobs).set({ category: null } as any).where(eq(jobs.id, job.id));
        cleared++;
      }
    }
    res.json({ message: `Category migration complete`, mapped, cleared, unchanged, total: allJobs.length });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/api/admin/migrate-uploads-to-r2", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  if (!isR2Configured()) {
    return res.status(400).json({ message: "R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL." });
  }
  try {
    const fs = await import("fs");
    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) {
      return res.json({ message: "No uploads directory found", migrated: 0, updated: 0 });
    }
    const imageExts = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
    const files = fs.readdirSync(uploadsDir).filter(f => imageExts.test(f));
    const urlMap = new Map<string, string>();
    let migrated = 0;
    for (const file of files) {
      const filePath = path.join(uploadsDir, file);
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(file).toLowerCase();
      const mimeMap: Record<string, string> = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
        ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
      };
      const contentType = mimeMap[ext] || "application/octet-stream";
      const r2Url = await uploadToR2(buffer, file, contentType);
      urlMap.set(`/uploads/${file}`, r2Url);
      migrated++;
    }
    let updated = 0;
    const settingsData = await storage.getSiteSettings() as Record<string, any>;
    if (settingsData && typeof settingsData === "object") {
      let settingsChanged = false;
      for (const [key, value] of Object.entries(settingsData)) {
        if (typeof value === "string" && urlMap.has(value)) {
          settingsData[key] = urlMap.get(value)!;
          settingsChanged = true;
          updated++;
        }
      }
      if (settingsChanged) {
        await storage.updateSiteSettings(settingsData as any);
      }
    }
    const allUsers = await storage.getUsers();
    for (const user of allUsers) {
      const updates: Record<string, string> = {};
      if (user.profileImage && urlMap.has(user.profileImage)) {
        updates.profileImage = urlMap.get(user.profileImage)!;
      }
      if (user.companyLogo && urlMap.has(user.companyLogo)) {
        updates.companyLogo = urlMap.get(user.companyLogo)!;
      }
      if (Object.keys(updates).length > 0) {
        await storage.updateUser(user.id, updates);
        updated += Object.keys(updates).length;
      }
    }
    res.json({ message: "Migration complete", migrated, updated, urlMap: Object.fromEntries(urlMap) });
  } catch (err: any) {
    console.error("R2 migration error:", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
