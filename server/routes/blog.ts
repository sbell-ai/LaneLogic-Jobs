import { Router } from "express";
import { storage } from "../storage";
import { api } from "@shared/routes";
import { requireAdminSession } from "../middleware/requireAdminSession.ts";

const router = Router();

// Blog
router.get(api.blog.list.path, async (req, res) => {
  const isAdmin = req.isAuthenticated() && (req.user as any).role === "admin";
  const posts = await storage.getBlogPosts();
  res.json(isAdmin ? posts : posts.filter(p => p.isPublished));
});

router.get(api.blog.get.path, async (req, res) => {
  const param = req.params.id;
  const numericId = Number(param);
  const post = isNaN(numericId)
    ? await storage.getBlogPostBySlug(param)
    : (await storage.getBlogPostBySlug(param)) ?? await storage.getBlogPost(numericId);
  if (!post) return res.status(404).json({ message: "Not found" });
  const isAdmin = req.isAuthenticated() && (req.user as any).role === "admin";
  if (!isAdmin && !post.isPublished) return res.status(404).json({ message: "Not found" });
  res.json(post);
});

router.post(api.blog.create.path, async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const raw = api.blog.create.input.parse(req.body);
    const input = {
      ...raw,
      slug: typeof raw.slug === "string" ? raw.slug.trim() || null : raw.slug ?? null,
    };
    const post = await storage.createBlogPost(input);
    res.status(201).json(post);
  } catch (err) {
    res.status(400).json({ message: "Validation error" });
  }
});

// Blog update/delete
router.put("/api/blog/:id", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const updates = { ...req.body };
    if (updates.publishedAt && typeof updates.publishedAt === "string") {
      updates.publishedAt = new Date(updates.publishedAt);
    }
    if (typeof updates.slug === "string") {
      updates.slug = updates.slug.trim() || null;
    }
    const post = await storage.updateBlogPost(Number(req.params.id), updates);
    res.json(post);
  } catch (err) {
    res.status(400).json({ message: "Update failed" });
  }
});

router.delete("/api/blog/:id", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  await storage.deleteBlogPost(Number(req.params.id));
  res.json({ message: "Deleted" });
});

export default router;
