import { Router } from "express";
import { storage } from "../storage";
import { requireAdminSession } from "../middleware/requireAdminSession.ts";

const router = Router();

// Coupons
router.get("/api/coupons", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  const allCoupons = await storage.getCoupons();
  res.json(allCoupons);
});

router.post("/api/coupons", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const coupon = await storage.createCoupon(req.body);
    res.status(201).json(coupon);
  } catch (err) {
    res.status(400).json({ message: "Validation error" });
  }
});

router.put("/api/coupons/:id", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const coupon = await storage.updateCoupon(Number(req.params.id), req.body);
    res.json(coupon);
  } catch (err) {
    res.status(400).json({ message: "Update failed" });
  }
});

router.delete("/api/coupons/:id", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  await storage.deleteCoupon(Number(req.params.id));
  res.json({ message: "Deleted" });
});

router.post("/api/coupons/validate", async (req, res) => {
  const { code, tier } = req.body;
  if (!code) return res.status(400).json({ message: "Code required" });
  const coupon = await storage.getCouponByCode(code.toUpperCase());
  if (!coupon) return res.status(404).json({ message: "Invalid coupon code" });
  if (!coupon.isActive) return res.status(400).json({ message: "Coupon is no longer active" });
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
    return res.status(400).json({ message: "Coupon has expired" });
  }
  if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) {
    return res.status(400).json({ message: "Coupon usage limit reached" });
  }
  if (coupon.appliesTo !== "all" && tier && coupon.appliesTo !== tier) {
    return res.status(400).json({ message: `Coupon only applies to ${coupon.appliesTo} tier` });
  }
  res.json(coupon);
});

export default router;
