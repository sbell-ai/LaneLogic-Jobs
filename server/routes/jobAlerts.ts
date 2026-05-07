import { Router } from "express";
import { storage } from "../storage";

const router = Router();

// ── Job Alert Subscriptions ──────────────────────────────────────────────
// GET /api/alerts — list seeker's own alerts
router.get("/api/alerts", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  const user = req.user as any;
  const alerts = await storage.getJobAlerts(user.id);
  res.json(alerts);
});

// POST /api/alerts — create a new alert
router.post("/api/alerts", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  const user = req.user as any;
  const { name, keyword, category, subcategory, locationState, jobType, workLocationType } = req.body;
  // Require at least one filter
  if (!keyword && !category && !locationState && !jobType && !workLocationType) {
    return res.status(400).json({ message: "At least one filter (keyword, category, location, job type) is required" });
  }
  const existing = await storage.getJobAlerts(user.id);
  if (existing.length >= 5) {
    return res.status(400).json({ message: "You can have at most 5 job alerts" });
  }
  const alert = await storage.createJobAlert({
    userId: user.id,
    name: name || null,
    keyword: keyword || null,
    category: category || null,
    subcategory: subcategory || null,
    locationState: locationState || null,
    jobType: jobType || null,
    workLocationType: workLocationType || null,
    isActive: true,
  });
  res.status(201).json(alert);
});

// PATCH /api/alerts/:id — update alert (pause/resume, rename)
router.patch("/api/alerts/:id", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  const user = req.user as any;
  const alertId = Number(req.params.id);
  if (isNaN(alertId)) return res.status(400).json({ message: "Invalid alert id" });
  const { isActive, name } = req.body;
  const updates: { isActive?: boolean; name?: string } = {};
  if (typeof isActive === "boolean") updates.isActive = isActive;
  if (typeof name === "string") updates.name = name;
  const alert = await storage.updateJobAlert(alertId, user.id, updates);
  if (!alert) return res.status(404).json({ message: "Alert not found" });
  res.json(alert);
});

// DELETE /api/alerts/:id — delete an alert
router.delete("/api/alerts/:id", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  const user = req.user as any;
  const alertId = Number(req.params.id);
  if (isNaN(alertId)) return res.status(400).json({ message: "Invalid alert id" });
  await storage.deleteJobAlert(alertId, user.id);
  res.status(204).end();
});

// Saved Jobs
// GET /api/saved-jobs — list seeker's saved jobs (returns SavedJob[] with jobId)
router.get("/api/saved-jobs", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  const user = req.user as any;
  if (user.role !== "job_seeker") return res.status(403).json({ message: "Forbidden" });
  const saved = await storage.getSavedJobsBySeeker(user.id);
  res.json(saved);
});

// POST /api/saved-jobs — save a job
router.post("/api/saved-jobs", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  const user = req.user as any;
  if (user.role !== "job_seeker") return res.status(403).json({ message: "Forbidden" });
  const jobId = Number(req.body.jobId);
  if (!jobId) return res.status(400).json({ message: "jobId required" });
  const saved = await storage.saveJob(user.id, jobId);
  res.json(saved);
});

// DELETE /api/saved-jobs/:jobId — unsave a job
router.delete("/api/saved-jobs/:jobId", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  const user = req.user as any;
  if (user.role !== "job_seeker") return res.status(403).json({ message: "Forbidden" });
  const jobId = Number(req.params.jobId);
  await storage.unsaveJob(user.id, jobId);
  res.status(204).end();
});

export default router;
