import { Router } from "express";
import express from "express";
import path from "path";
import { randomUUID } from "crypto";
import { storage } from "../storage";
import { isR2Configured, uploadToR2 } from "../r2";
import { imageUpload } from "./helpers";

const router = Router();

router.patch("/api/profile", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const userId = (req.user as any).id;
    const allowed = ["firstName", "lastName", "companyName", "companyAddress", "contactName", "contactEmail", "contactPhone", "aboutCompany", "profileImage", "companyLogo", "showProfile", "showName", "showCurrentEmployer"];
    const updates: Record<string, any> = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }
    const user = await storage.updateUser(userId, updates);
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Could not update profile" });
  }
});

router.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

router.post("/api/upload", (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}, imageUpload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  try {
    if (isR2Configured()) {
      const ext = path.extname(req.file.originalname);
      const key = `${randomUUID()}${ext}`;
      const url = await uploadToR2(req.file.buffer, key, req.file.mimetype);
      return res.json({ url });
    }
    const uploadsDir = path.join(process.cwd(), "uploads");
    const fs = await import("fs");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const ext = path.extname(req.file.originalname);
    const filename = `${randomUUID()}${ext}`;
    fs.writeFileSync(path.join(uploadsDir, filename), req.file.buffer);
    res.json({ url: `/uploads/${filename}` });
  } catch (err: any) {
    console.error("Upload error:", err);
    res.status(500).json({ message: err.message || "Upload failed" });
  }
});

export default router;
