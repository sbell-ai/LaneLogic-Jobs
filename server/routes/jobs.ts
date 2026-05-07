import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { api } from "@shared/routes";
import { checkEntitlement } from "../registry/entitlementResolver";
import { validateCategoryPair } from "@shared/jobTaxonomy";
import { requireAdminSession } from "../middleware/requireAdminSession.ts";
import { daysFromNow } from "./helpers";

const router = Router();

// Jobs
router.get(api.jobs.list.path, async (req, res) => {
  const isAdmin = req.isAuthenticated() && (req.user as any).role === "admin";
  const allJobs = await storage.getJobs();
  const now = new Date();
  const visibleJobs = isAdmin ? allJobs : allJobs.filter(j => {
    if (!j.isPublished) return false;
    if (j.expiresAt) {
      const expires = typeof j.expiresAt === "string" ? new Date(j.expiresAt) : j.expiresAt;
      if (expires < now) return false;
    }
    return true;
  });
  const allUsers = await storage.getUsers();
  const employerMap = new Map(allUsers.filter(u => u.role === "employer").map(u => [u.id, u]));
  const enriched = visibleJobs.map(job => ({
    ...job,
    employerLogo: employerMap.get(job.employerId)?.companyLogo || null,
    employerHasProfile: employerMap.has(job.employerId),
    employerVerificationStatus: employerMap.get(job.employerId)?.verificationStatus || null,
  }));
  res.json(enriched);
});

router.get(api.jobs.get.path, async (req, res) => {
  const job = await storage.getJob(Number(req.params.id));
  if (!job) return res.status(404).json({ message: "Not found" });
  const isAdmin = req.isAuthenticated() && (req.user as any).role === "admin";
  if (!isAdmin && !job.isPublished) return res.status(404).json({ message: "Not found" });
  if (!isAdmin && job.expiresAt) {
    const expires = typeof job.expiresAt === "string" ? new Date(job.expiresAt) : job.expiresAt;
    if (expires < new Date()) return res.status(404).json({ message: "Not found" });
  }
  const employer = await storage.getUser(job.employerId);
  res.json({
    ...job,
    employerLogo: employer?.companyLogo || null,
    employerVerificationStatus: employer?.verificationStatus || null,
    employerIsRegistered: !!employer,
  });
});

router.post(api.jobs.create.path, async (req, res) => {
  try {
    if (req.isAuthenticated()) {
      const user = req.user as any;
      if (user.role === "employer") {
        const ent = await checkEntitlement(user, "job_posts_per_month");
        if (!ent.allowed) {
          return res.status(403).json({ message: "You have reached your job posting limit for this month. Please upgrade your plan." });
        }
      }
    }
    const body = { ...req.body };
    if (body.expiresAt && typeof body.expiresAt === "string") body.expiresAt = new Date(body.expiresAt);
    if (body.expiresAt === null || body.expiresAt === "") body.expiresAt = null;
    if (body.category === "") body.category = null;
    if (body.subcategory === "") body.subcategory = null;
    if (!body.workLocationType || body.workLocationType === "none") body.workLocationType = null;

    // Expiration rules
    const postingUser = req.isAuthenticated() ? (req.user as any) : null;
    if (postingUser?.role === "admin") {
      body.expiresAt = daysFromNow(30);
    } else if (postingUser?.role === "employer") {
      if (!body.expiresAt) {
        body.expiresAt = daysFromNow(30);
      } else {
        if (new Date(body.expiresAt) > daysFromNow(31)) {
          return res.status(400).json({ message: "Expiration date cannot be more than 31 days from today." });
        }
      }
    }

    const catCheck = validateCategoryPair(body.category ?? null, body.subcategory ?? null);
    if (!catCheck.valid) return res.status(400).json({ message: catCheck.error });
    const input = api.jobs.create.input.parse(body);
    const job = await storage.createJob(input);
    res.status(201).json(job);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put(api.jobs.update.path, async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  const user = req.user as any;
  const jobId = Number(req.params.id);
  const existingJob = await storage.getJob(jobId);
  if (!existingJob) return res.status(404).json({ message: "Job not found" });
  if (user.role !== "admin" && existingJob.employerId !== user.id) return res.status(403).json({ message: "Forbidden" });
  try {
    const body = { ...req.body };
    if (body.expiresAt && typeof body.expiresAt === "string") body.expiresAt = new Date(body.expiresAt);
    if (body.expiresAt === null || body.expiresAt === "") body.expiresAt = null;
    if (body.publishedAt && typeof body.publishedAt === "string") body.publishedAt = new Date(body.publishedAt);
    if (body.publishedAt === null || body.publishedAt === "") body.publishedAt = null;
    if (body.category === "") body.category = null;
    if (body.subcategory === "") body.subcategory = null;
    if (body.workLocationType === "" || body.workLocationType === "none") body.workLocationType = null;

    // Expiration rules on update
    if (user.role === "admin") {
      body.expiresAt = daysFromNow(30);
    } else {
      // employer: if no new date provided, preserve existing expiration; otherwise validate cap
      if (!body.expiresAt) {
        delete body.expiresAt;
      } else {
        if (new Date(body.expiresAt) > daysFromNow(31)) {
          return res.status(400).json({ message: "Expiration date cannot be more than 31 days from today." });
        }
      }
    }

    const mergedCat = body.category !== undefined ? body.category : existingJob.category;
    const mergedSub = body.subcategory !== undefined ? body.subcategory : existingJob.subcategory;
    const catCheck = validateCategoryPair(mergedCat ?? null, mergedSub ?? null);
    if (!catCheck.valid) return res.status(400).json({ message: catCheck.error });
    const input = api.jobs.update.input.parse(body);
    const job = await storage.updateJob(jobId, input);
    res.json(job);

    // Fire job_posted email when isPublished flips false→true
    if (!existingJob.isPublished && (input as any).isPublished) {
      (async () => {
        try {
          const { sendTemplatedEmailByEvent } = await import("../email/sendTemplatedEmail.ts");
          const employer = await storage.getUser(job.employerId);
          if (!employer) return;
          const siteUrl = process.env.CANONICAL_HOST || "https://lanelogicjobs.com";
          await sendTemplatedEmailByEvent("job_posted", (employer as any).email, {
            first_name: (employer as any).firstName || (employer as any).companyName || (employer as any).email,
            company_name: (employer as any).companyName || "",
            job_title: job.title,
            job_url: `${siteUrl}/jobs/${job.id}`,
            dashboard_url: `${siteUrl}/dashboard`,
            site_name: "LaneLogic Jobs",
            site_url: siteUrl,
          });
        } catch (e: any) {
          console.error("job_posted email failed:", e?.message);
        }
      })();

      // Fire job alert emails for matching subscriptions (fire-and-forget)
      (async () => {
        try {
          const { sendTemplatedEmailByEvent } = await import("../email/sendTemplatedEmail.ts");
          const alerts = await storage.getAllJobAlerts();
          const siteUrl = process.env.CANONICAL_HOST || "https://lanelogicjobs.com";
          const jobTitle = (job.title || "").toLowerCase();
          const jobDesc = (job.description || "").toLowerCase();

          for (const alert of alerts) {
            // Match keyword
            if (alert.keyword) {
              const kw = alert.keyword.toLowerCase();
              if (!jobTitle.includes(kw) && !jobDesc.includes(kw)) continue;
            }
            // Match category
            if (alert.category && alert.category !== job.category) continue;
            // Match subcategory
            if (alert.subcategory && alert.subcategory !== job.subcategory) continue;
            // Match locationState
            if (alert.locationState && alert.locationState !== job.locationState) continue;
            // Match jobType
            if (alert.jobType && alert.jobType !== job.jobType) continue;
            // Match workLocationType
            if (alert.workLocationType && alert.workLocationType !== job.workLocationType) continue;

            // Passed all filters — notify this subscriber
            const subscriber = await storage.getUser(alert.userId);
            if (!subscriber) continue;
            await sendTemplatedEmailByEvent("job_alert", (subscriber as any).email, {
              first_name: (subscriber as any).firstName || (subscriber as any).email,
              job_title: job.title,
              company_name: job.companyName || "",
              job_url: `${siteUrl}/jobs/${job.id}`,
              site_name: "LaneLogic Jobs",
              site_url: siteUrl,
              unsubscribe_url: `${siteUrl}/dashboard`,
            });
            await storage.updateJobAlertNotifiedAt(alert.id, new Date());
          }
        } catch (e: any) {
          console.error("job_alert emails failed:", e?.message);
        }
      })();
    }
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete(api.jobs.delete.path, async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  const user = req.user as any;
  const jobId = Number(req.params.id);
  const existingJob = await storage.getJob(jobId);
  if (!existingJob) return res.status(404).json({ message: "Job not found" });
  if (user.role !== "admin" && existingJob.employerId !== user.id) return res.status(403).json({ message: "Forbidden" });
  await storage.deleteJob(jobId);
  res.status(204).end();
});

router.put("/api/jobs-bulk-update", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const { ids, updates } = req.body as { ids: number[]; updates: Record<string, any> };
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "No job IDs provided" });
    const allowed = ["jobType", "category", "subcategory", "industry"];
    const filtered: Record<string, any> = {};
    for (const key of allowed) {
      if (key in updates) filtered[key] = updates[key];
    }
    if (Object.keys(filtered).length === 0) return res.status(400).json({ message: "No valid fields to update" });
    if ("category" in filtered && filtered.category === "") filtered.category = null;
    if ("subcategory" in filtered && filtered.subcategory === "") filtered.subcategory = null;
    if ("category" in filtered || "subcategory" in filtered) {
      const hasCatUpdate = "category" in filtered;
      const hasSubUpdate = "subcategory" in filtered;
      if (hasCatUpdate && hasSubUpdate) {
        const catCheck = validateCategoryPair(filtered.category ?? null, filtered.subcategory ?? null);
        if (!catCheck.valid) return res.status(400).json({ message: catCheck.error });
      } else {
        for (const id of ids) {
          const existingJob = await storage.getJob(id);
          if (!existingJob) continue;
          const mergedCat = hasCatUpdate ? (filtered.category ?? null) : (existingJob.category ?? null);
          const mergedSub = hasSubUpdate ? (filtered.subcategory ?? null) : (existingJob.subcategory ?? null);
          const catCheck = validateCategoryPair(mergedCat, mergedSub);
          if (!catCheck.valid) return res.status(400).json({ message: `Job #${id}: ${catCheck.error}` });
        }
      }
    }
    const results = await Promise.all(ids.map(id => storage.updateJob(id, filtered)));
    res.json({ updated: results.length });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
