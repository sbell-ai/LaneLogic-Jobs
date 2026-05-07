import { Router } from "express";
import { storage } from "../storage";
import { api } from "@shared/routes";
import { resolveUserEntitlements } from "../registry/entitlementResolver";

const router = Router();

// Resumes
// GET /api/seeker-search — employer discovers seekers who have public profiles
router.get("/api/seeker-search", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  const user = req.user as any;
  if (user.role !== "employer" && user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
  const { keyword = "", track = "" } = req.query as Record<string, string>;
  const allUsers = await storage.getUsers();
  const seekers = allUsers.filter((u: any) => {
    if (u.role !== "job_seeker") return false;
    if (!u.showProfile) return false;
    // keyword match against name/email/seekerTrack
    if (keyword) {
      const kw = keyword.toLowerCase();
      const name = [(u.firstName || ""), (u.lastName || ""), (u.email || "")].join(" ").toLowerCase();
      const trackStr = (u.seekerTrack || "").toLowerCase();
      if (!name.includes(kw) && !trackStr.includes(kw)) return false;
    }
    // track filter
    if (track && u.seekerTrack !== track) return false;
    return true;
  });
  // Return sanitized data — no sensitive fields
  const result = seekers.map((u: any) => ({
    id: u.id,
    firstName: u.showName ? u.firstName : null,
    lastName: u.showName ? u.lastName : null,
    email: u.showName ? u.email : null,
    seekerTrack: u.seekerTrack,
    seekerVerificationStatus: u.seekerVerificationStatus,
    profileImage: u.profileImage,
    createdAt: u.createdAt,
  }));
  res.json(result);
});

router.get(api.resumes.get.path, async (req, res) => {
  if (!req.isAuthenticated() || !req.user) return res.status(401).json({ message: "Unauthorized" });
  const caller = req.user as any;
  const targetId = Number(req.params.jobSeekerId);
  if (caller.role !== "admin" && caller.id !== targetId) {
    return res.status(403).json({ message: "Forbidden" });
  }
  const userResumes = await storage.getResumes(targetId);
  res.json(userResumes);
});

router.post(api.resumes.create.path, async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  try {
    const input = api.resumes.create.input.parse(req.body);
    const user = req.user as any;

    (input as any).jobSeekerId = user.id;

    const entitlements = await resolveUserEntitlements(user);
    const ent = entitlements?.["resumes_per_month"];

    if (!ent) {
      return res.status(403).json({ message: "Your plan does not include resume storage. Upgrade to add resumes.", code: "NO_ENTITLEMENT" });
    }

    if (!ent.isUnlimited) {
      const existing = await storage.getResumes(user.id);
      if (existing.length >= ent.value) {
        return res.status(403).json({
          message: `You've reached your resume limit (${ent.value}). Upgrade your plan to add more.`,
          code: "LIMIT_REACHED",
          limit: ent.value,
          current: existing.length,
        });
      }
    }

    const resume = await storage.createResume(input);
    res.status(201).json(resume);
  } catch (err) {
    res.status(400).json({ message: "Validation error" });
  }
});

export default router;
