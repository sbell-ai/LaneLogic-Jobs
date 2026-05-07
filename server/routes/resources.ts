import { Router } from "express";
import { storage } from "../storage";
import { api } from "@shared/routes";
import { requireAdminSession } from "../middleware/requireAdminSession.ts";

const router = Router();

// Resources
router.get(api.resources.list.path, async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Login required" });
  const user = req.user as any;
  const isAdmin = user.role === "admin";
  const allResources = await storage.getResources(isAdmin ? "admin" : "public");
  if (isAdmin) return res.json(allResources);
  const role: string = user.role;
  const filtered = allResources.filter((r) => {
    if (role === "employer") return r.targetAudience === "employer" || r.targetAudience === "both";
    if (role === "job_seeker") return r.targetAudience === "job_seeker" || r.targetAudience === "both";
    return false;
  });
  res.json(filtered);
});

router.get("/api/resources/slug/:slug", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Login required" });
  const resource = await storage.getResourceBySlug(req.params.slug);
  if (!resource) return res.status(404).json({ message: "Not found" });
  const user = req.user as any;
  const isAdmin = user.role === "admin";
  if (!isAdmin && !resource.isPublished) return res.status(404).json({ message: "Not found" });
  if (!isAdmin) {
    const role: string = user.role;
    const allowed = role === "employer"
      ? resource.targetAudience === "employer" || resource.targetAudience === "both"
      : role === "job_seeker"
        ? resource.targetAudience === "job_seeker" || resource.targetAudience === "both"
        : false;
    if (!allowed) return res.status(403).json({ message: "This resource is not available for your account type" });
  }
  res.json(resource);
});

router.get("/api/resources/:id", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Login required" });
  const resource = await storage.getResource(Number(req.params.id));
  if (!resource) return res.status(404).json({ message: "Not found" });
  const user = req.user as any;
  const isAdmin = user.role === "admin";
  if (!isAdmin && !resource.isPublished) return res.status(404).json({ message: "Not found" });
  if (!isAdmin) {
    const role: string = user.role;
    const allowed = role === "employer"
      ? resource.targetAudience === "employer" || resource.targetAudience === "both"
      : role === "job_seeker"
        ? resource.targetAudience === "job_seeker" || resource.targetAudience === "both"
        : false;
    if (!allowed) return res.status(403).json({ message: "This resource is not available for your account type" });
  }
  res.json(resource);
});

router.post(api.resources.create.path, async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const input = api.resources.create.input.parse(req.body);
    if ((input as any).isPublished && (!(input as any).bodyText || (input as any).bodyText.trim() === "")) {
      return res.status(400).json({ message: "Cannot publish a resource with empty body text" });
    }
    const resource = await storage.createResource(input);
    res.status(201).json(resource);
  } catch (err) {
    res.status(400).json({ message: "Validation error" });
  }
});

// Resource update/delete
router.put("/api/resources/:id", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const updates = { ...req.body };
    if (updates.publishedAt && typeof updates.publishedAt === "string") {
      updates.publishedAt = new Date(updates.publishedAt);
    }
    if (updates.isPublished) {
      const existing = await storage.getResource(Number(req.params.id));
      const bodyText = updates.bodyText !== undefined ? updates.bodyText : existing?.bodyText;
      if (!bodyText || bodyText.trim() === "") {
        return res.status(400).json({ message: "Cannot publish a resource with empty body text" });
      }
    }
    const resource = await storage.updateResource(Number(req.params.id), updates);
    res.json(resource);
  } catch (err) {
    console.error("Resource update error:", err);
    res.status(400).json({ message: "Update failed", error: (err as Error).message });
  }
});

router.delete("/api/resources/:id", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  await storage.deleteResource(Number(req.params.id));
  res.json({ message: "Deleted" });
});

export default router;
