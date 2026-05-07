import { Router } from "express";
import { storage } from "../storage";
import { requireAdminSession } from "../middleware/requireAdminSession.ts";

const router = Router();

// Categories
router.get("/api/categories", async (_req, res) => {
  const cats = await storage.getCategories();
  res.json(cats);
});

router.post("/api/categories", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const cat = await storage.createCategory(req.body);
    res.status(201).json(cat);
  } catch (err) {
    res.status(400).json({ message: "Validation error" });
  }
});

router.delete("/api/categories/:id", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  await storage.deleteCategory(Number(req.params.id));
  res.json({ message: "Deleted" });
});

export default router;
