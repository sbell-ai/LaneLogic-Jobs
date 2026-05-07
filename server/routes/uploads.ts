import { Router } from "express";
import path from "path";
import { randomUUID } from "crypto";
import { storage } from "../storage";
import { isR2Configured, uploadToR2 } from "../r2";
import { requireAdminSession } from "../middleware/requireAdminSession.ts";
import { imageUpload } from "./helpers";

const router = Router();

// Admin: upload / update a company logo by company name
router.post("/api/admin/employer-logo", (req, res, next) => {
  if (!requireAdminSession(req, res)) return;
  next();
}, imageUpload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No logo file uploaded" });
  }
  const companyName = (req.body?.companyName || "").trim();
  if (!companyName) {
    return res.status(400).json({ message: "companyName is required" });
  }
  try {
    let logoUrl: string;
    if (isR2Configured()) {
      const ext = path.extname(req.file.originalname);
      const key = `logos/${randomUUID()}${ext}`;
      logoUrl = await uploadToR2(req.file.buffer, key, req.file.mimetype);
    } else {
      const uploadsDir = path.join(process.cwd(), "uploads");
      const fs = await import("fs");
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      const ext = path.extname(req.file.originalname);
      const filename = `${randomUUID()}${ext}`;
      fs.writeFileSync(path.join(uploadsDir, filename), req.file.buffer);
      logoUrl = `/uploads/${filename}`;
    }

    const employer = await storage.findOrCreateEmployerByCompanyName(companyName);
    await storage.updateUser(employer.id, { companyLogo: logoUrl });

    res.json({ employerId: employer.id, companyName, logoUrl });
  } catch (err: any) {
    console.error("Employer logo upload error:", err);
    res.status(500).json({ message: err.message || "Logo upload failed" });
  }
});

export default router;
