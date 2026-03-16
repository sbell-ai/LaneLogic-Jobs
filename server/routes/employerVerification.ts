import { Router } from "express";
import { storage } from "../storage";
import { requireAdminSession } from "../middleware/requireAdminSession";
import { z } from "zod";

export const employerVerificationRouter = Router();

function requireEmployerSession(req: any, res: any): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ ok: false, error: "unauthenticated" });
    return false;
  }
  if (req.user.role !== "employer") {
    res.status(403).json({ ok: false, error: "forbidden", message: "Employer access required" });
    return false;
  }
  return true;
}

employerVerificationRouter.post("/api/employer/verification/request/get-or-create", async (req, res) => {
  if (!requireEmployerSession(req, res)) return;
  try {
    const request = await storage.getOrCreateVerificationRequest(req.user.id);
    const evidence = await storage.getEvidenceItemsByRequest(request.id);
    res.json({ request, evidence });
  } catch (err) {
    console.error("[Verification] get-or-create error:", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

employerVerificationRouter.get("/api/employer/verification/request", async (req, res) => {
  if (!requireEmployerSession(req, res)) return;
  try {
    const request = await storage.getLatestVerificationRequest(req.user.id);
    if (!request) {
      return res.json({ request: null, evidence: [] });
    }
    const evidence = await storage.getEvidenceItemsByRequest(request.id);
    res.json({ request, evidence });
  } catch (err) {
    console.error("[Verification] get request error:", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

employerVerificationRouter.get("/api/employer/verification/requirements", async (_req, res) => {
  res.json({ requirements: [] });
});

function isValidHttpUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const evidenceSchema = z.object({
  requestId: z.number(),
  sourceType: z.string().min(1),
  sourceUrl: z.string().optional().nullable().refine(
    (val) => !val || isValidHttpUrl(val),
    { message: "Source URL must be a valid http or https URL" }
  ),
  excerpt: z.string().optional().nullable(),
  claim: z.string().optional().nullable(),
});

employerVerificationRouter.post("/api/employer/verification/evidence", async (req, res) => {
  if (!requireEmployerSession(req, res)) return;
  try {
    const parsed = evidenceSchema.parse(req.body);
    const request = await storage.getActiveVerificationRequest(req.user.id);
    if (!request || request.id !== parsed.requestId) {
      return res.status(400).json({ ok: false, error: "invalid_request", message: "No active verification request found" });
    }
    if (request.status === "submitted") {
      return res.status(400).json({ ok: false, error: "already_submitted", message: "Request already submitted" });
    }
    const item = await storage.createEvidenceItem(parsed);
    res.status(201).json(item);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ ok: false, error: "validation_error", message: err.errors[0].message });
    }
    console.error("[Verification] evidence error:", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

employerVerificationRouter.post("/api/employer/verification/request/submit", async (req, res) => {
  if (!requireEmployerSession(req, res)) return;
  try {
    const request = await storage.getActiveVerificationRequest(req.user.id);
    if (!request) {
      return res.status(400).json({ ok: false, error: "no_request", message: "No active verification request found" });
    }
    if (request.status === "submitted") {
      return res.status(400).json({ ok: false, error: "already_submitted", message: "Already submitted" });
    }
    const evidence = await storage.getEvidenceItemsByRequest(request.id);
    if (evidence.length === 0) {
      return res.status(400).json({ ok: false, error: "no_evidence", message: "Please add at least one evidence item before submitting" });
    }
    const updated = await storage.updateVerificationRequestStatus(request.id, "submitted");
    res.json({ request: updated });
  } catch (err) {
    console.error("[Verification] submit error:", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

const decisionSchema = z.object({
  requestId: z.number(),
  decision: z.enum(["verified", "rejected", "needs_more"]),
  adminNotes: z.string().optional(),
});

employerVerificationRouter.get("/api/admin/employer-verification/inbox", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const requests = await storage.getVerificationRequestsByStatus(["submitted", "needs_more"]);
    const withEvidence = await Promise.all(
      requests.map(async (r) => ({
        ...r,
        evidence: await storage.getEvidenceItemsByRequest(r.id),
      }))
    );
    res.json(withEvidence);
  } catch (err) {
    console.error("[Verification] inbox error:", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

employerVerificationRouter.post("/api/admin/employer-verification/request/decision", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const parsed = decisionSchema.parse(req.body);
    const adminId = (req as any).user.id;
    const updated = await storage.updateVerificationRequestStatus(
      parsed.requestId,
      parsed.decision,
      parsed.adminNotes,
      adminId
    );
    if (parsed.decision === "verified") {
      await storage.updateEmployerVerificationStatus(updated.employerId, "verified");
    } else if (parsed.decision === "rejected") {
      await storage.updateEmployerVerificationStatus(updated.employerId, "rejected");
    }
    res.json({ request: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ ok: false, error: "validation_error", message: err.errors[0].message });
    }
    console.error("[Verification] decision error:", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});
