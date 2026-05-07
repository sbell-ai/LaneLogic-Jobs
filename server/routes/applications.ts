import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { api } from "@shared/routes";
import { db } from "../db";
import { consumeEntitlement } from "../registry/entitlementResolver";
import { requireAdminSession } from "../middleware/requireAdminSession.ts";

const router = Router();

// Applications — admin-only list (employer/seeker views use /api/employer/applicants and /api/seeker/applications)
router.get(api.applications.list.path, async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  const apps = await storage.getApplications();
  res.json(apps);
});

// Enriched applicants for the logged-in employer
router.get("/api/employer/applicants", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  const user = req.user as any;
  if (user.role !== "employer" && user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
  const apps = await storage.getEmployerApplicationsEnriched(user.id);
  // Strip seeker-private notes before returning to employers
  const safeApps = apps.map(({ seekerNotes: _s, ...rest }: any) => rest);
  res.json(safeApps);
});

// GET /api/seeker/applications — returns the logged-in seeker's own applications (including viewedAt)
router.get("/api/seeker/applications", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  const user = req.user as any;
  if (user.role !== "job_seeker" && user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
  const apps = await storage.getApplicationsBySeeker(user.id);
  res.json(apps);
});

// GET /api/employer/analytics — summary stats for employer dashboard
router.get("/api/employer/analytics", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  const user = req.user as any;
  if (user.role !== "employer" && user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
  const [apps, allJobs] = await Promise.all([
    storage.getEmployerApplicationsEnriched(user.id),
    storage.getJobs(),
  ]);
  const myJobs = allJobs.filter((j: any) => j.employerId === user.id);
  const activeJobs = myJobs.filter((j: any) => j.status === "active" || j.isPublished).length;
  const totalApps = apps.length;
  const newApps = apps.filter((a: any) => !a.viewedAt).length;
  const shortlisted = apps.filter((a: any) => ["shortlisted", "reviewed"].includes(a.status)).length;
  const hired = apps.filter((a: any) => ["hired", "accepted"].includes(a.status)).length;

  // Applications in last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentApps = apps.filter((a: any) => a.createdAt && new Date(a.createdAt) >= thirtyDaysAgo).length;

  // Daily breakdown for bar chart (last 30 days)
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const dailyMap: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dailyMap[key] = 0;
  }
  for (const a of apps) {
    if (!a.createdAt) continue;
    const key = new Date(a.createdAt).toISOString().slice(0, 10);
    if (key in dailyMap) dailyMap[key]++;
  }
  const dailyBreakdown = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

  // Per-job stats
  const now = Date.now();
  const perJobStats = myJobs.map((job: any) => {
    const jobApps = apps.filter((a: any) => a.jobId === job.id);
    const daysActive = job.createdAt
      ? Math.max(0, Math.floor((now - new Date(job.createdAt).getTime()) / (1000 * 60 * 60 * 24)))
      : 0;
    const daysUntilExpiry = job.expiresAt
      ? Math.max(0, Math.ceil((new Date(job.expiresAt).getTime() - now) / (1000 * 60 * 60 * 24)))
      : null;
    return {
      jobId: job.id,
      title: job.title,
      isPublished: job.isPublished,
      totalApps: jobApps.length,
      newApps: jobApps.filter((a: any) => !a.viewedAt).length,
      shortlisted: jobApps.filter((a: any) => ["shortlisted", "reviewed"].includes(a.status)).length,
      hired: jobApps.filter((a: any) => ["hired", "accepted"].includes(a.status)).length,
      daysActive,
      daysUntilExpiry,
    };
  });

  res.json({ activeJobs, totalJobs: myJobs.length, totalApps, newApps, shortlisted, hired, recentApps, dailyBreakdown, perJobStats });
});

router.post(api.applications.create.path, async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "You must be logged in to apply for jobs." });
    }
    const user = req.user as any;
    const input = api.applications.create.input.parse(req.body);

    if (user.role === "job_seeker") {
      (input as any).jobSeekerId = user.id;

      const txResult = await storage.runTransaction(async (tx) => {
        const result = await consumeEntitlement(user, "applications_per_month", { sourceEvent: "application", tx });
        if (!result.allowed) {
          return { denied: true, result };
        }
        const appData = await storage.createApplication(input, tx);
        return { denied: false, appData, result };
      });

      if (txResult.denied) {
        return res.status(403).json({
          message: "You have reached your application limit for this month. Purchase a top-up credit pack or wait until your quota resets.",
          error: txResult.result.error,
          resetDate: txResult.result.resetDate,
        });
      }

      let verificationWarning: string | undefined;
      try {
        const job = await storage.getJob((input as any).jobId);
        if (job) {
          const jobTags = (job.tags || []).filter((t): t is string => !!t);
          let employerCategory: string | null = null;
          const employer = await storage.getUser(job.employerId);
          if (employer) employerCategory = employer.employerCategory || null;
          const jobState = job.locationState || null;
          const { computeRequirementsForSeeker } = await import("./seekerVerification");
          const computed = await computeRequirementsForSeeker(user.seekerTrack, jobTags, employerCategory, jobState);
          if (computed.length > 0) {
            const activeReq = await storage.getOrCreateSeekerVerificationRequest(user.id);
            await storage.appendRequirementsSnapshot(activeReq.id, computed.map(r => r.key));
          }
        }
      } catch (appendErr) {
        console.error("[applications] seeker verification append error:", appendErr);
        verificationWarning = "Application submitted, but credential requirements could not be updated. Visit your credentials page to review.";
      }

      const responseData = verificationWarning
        ? { ...txResult.appData, verificationWarning }
        : txResult.appData;
      // Fire-and-forget application received email
      (async () => {
        try {
          const { sendTemplatedEmailByEvent } = await import("../email/sendTemplatedEmail.ts");
          const seekerUser = await storage.getUser(user.id);
          const appJob = await storage.getJob((txResult.appData as any).jobId);
          if (seekerUser && appJob) {
            const siteUrl = process.env.CANONICAL_HOST || "https://lanelogicjobs.com";
            const employer = await storage.getUser(appJob.employerId);
            const companyName = employer
              ? ((employer as any).companyName || [(employer as any).firstName, (employer as any).lastName].filter(Boolean).join(" "))
              : "the company";
            await sendTemplatedEmailByEvent("application_received", (seekerUser as any).email, {
              first_name: (seekerUser as any).firstName || (seekerUser as any).email,
              job_title: appJob.title,
              company_name: companyName,
              application_id: String((txResult.appData as any).id),
              site_url: siteUrl,
              dashboard_url: `${siteUrl}/dashboard`,
            });
            if (employer && (employer as any).email) {
              const applicantName = [(seekerUser as any).firstName, (seekerUser as any).lastName].filter(Boolean).join(" ") || (seekerUser as any).email;
              await sendTemplatedEmailByEvent("employer_new_applicant", (employer as any).email, {
                first_name: (employer as any).firstName || (employer as any).email,
                company_name: companyName,
                applicant_name: applicantName,
                job_title: appJob.title,
                site_name: "LaneLogic Jobs",
                site_url: siteUrl,
                dashboard_url: `${siteUrl}/dashboard`,
              });
            }
          }
        } catch {}
      })();
      return res.status(201).json(responseData);
    }

    const appData = await storage.createApplication(input);
    res.status(201).json(appData);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put(api.applications.update.path, async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  const user = req.user as any;
  const appId = Number(req.params.id);

  if (user.role === "job_seeker") {
    // Seekers may only update seekerNotes on their own applications
    const existing = await db.query.applications.findFirst({ where: (a, { eq }) => eq(a.id, appId) });
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (existing.jobSeekerId !== user.id) return res.status(403).json({ message: "Forbidden" });
    const { seekerNotes } = req.body;
    const appData = await storage.updateApplication(appId, { seekerNotes: seekerNotes ?? existing.seekerNotes });
    const { employerNotes: _e, ...seekerView } = appData as any;
    return res.json(seekerView);
  }

  if (user.role === "employer") {
    const existing = await db.query.applications.findFirst({ where: (a, { eq }) => eq(a.id, appId) });
    if (!existing) return res.status(404).json({ message: "Not found" });
    const job = await storage.getJob(existing.jobId);
    if (!job || job.employerId !== user.id) return res.status(403).json({ message: "Forbidden" });
  } else if (user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    const input = api.applications.update.input.parse(req.body);
    const appData = await storage.updateApplication(appId, input);
    const { seekerNotes: _s, ...employerView } = appData as any;
    res.json(employerView);
    // Fire-and-forget status change email
    if ((input as any).status) {
      (async () => {
        try {
          const { sendTemplatedEmailByEvent } = await import("../email/sendTemplatedEmail.ts");
          const updatedApp = await db.query.applications.findFirst({ where: (a, { eq }) => eq(a.id, appId) });
          if (!updatedApp) return;
          const [seekerUser, appJob] = await Promise.all([
            storage.getUser((updatedApp as any).seekerId),
            storage.getJob(updatedApp.jobId),
          ]);
          if (!seekerUser || !appJob) return;
          const employer = await storage.getUser(appJob.employerId);
          const siteUrl = process.env.CANONICAL_HOST || "https://lanelogicjobs.com";
          await sendTemplatedEmailByEvent("application_status_changed", (seekerUser as any).email, {
            first_name: (seekerUser as any).firstName || (seekerUser as any).email,
            job_title: appJob.title,
            company_name: employer ? ((employer as any).companyName || [(employer as any).firstName, (employer as any).lastName].filter(Boolean).join(" ")) : "the company",
            new_status: (input as any).status,
            application_id: String(appId),
            site_url: siteUrl,
            dashboard_url: `${siteUrl}/dashboard`,
          });
        } catch {}
      })();
    }
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/applications/:id/viewed — employer marks an application as viewed
router.post("/api/applications/:id/viewed", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  const user = req.user as any;
  if (user.role !== "employer" && user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
  const appId = Number(req.params.id);
  const existing = await db.query.applications.findFirst({ where: (a, { eq }) => eq(a.id, appId) });
  if (!existing) return res.status(404).json({ message: "Application not found" });
  // Verify employer owns the job (unless admin)
  if (user.role === "employer") {
    const appJob = await storage.getJob(existing.jobId);
    if (!appJob || appJob.employerId !== user.id) return res.status(403).json({ message: "Forbidden" });
  }
  await storage.markApplicationViewed(appId);
  res.json({ ok: true });
});

// DELETE /api/applications/:id — seeker withdraws their application
router.delete("/api/applications/:id", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  const user = req.user as any;
  const appId = Number(req.params.id);
  const existing = await db.query.applications.findFirst({ where: (a, { eq }) => eq(a.id, appId) });
  if (!existing) return res.status(404).json({ message: "Application not found" });
  // Only the seeker who owns it (or admin) may withdraw
  if (user.role !== "admin" && existing.jobSeekerId !== user.id) return res.status(403).json({ message: "Forbidden" });
  await storage.deleteApplication(appId);
  res.status(204).end();
  // Notify employer (fire-and-forget)
  (async () => {
    try {
      const { sendTemplatedEmailByEvent } = await import("../email/sendTemplatedEmail.ts");
      const [appJob, seeker] = await Promise.all([
        storage.getJob(existing.jobId),
        storage.getUser(existing.jobSeekerId),
      ]);
      if (!appJob || !seeker) return;
      const employer = await storage.getUser(appJob.employerId);
      if (!employer) return;
      const siteUrl = process.env.CANONICAL_HOST || "https://lanelogicjobs.com";
      const seekerName = [(seeker as any).firstName, (seeker as any).lastName].filter(Boolean).join(" ") || (seeker as any).email;
      await sendTemplatedEmailByEvent("application_withdrawn", (employer as any).email, {
        first_name: (employer as any).firstName || (employer as any).companyName || (employer as any).email,
        seeker_name: seekerName,
        job_title: appJob.title,
        company_name: (employer as any).companyName || "",
        dashboard_url: `${siteUrl}/dashboard`,
        site_url: siteUrl,
      });
    } catch (e: any) {
      console.error("application_withdrawn email failed:", e?.message);
    }
  })();
});

export default router;
