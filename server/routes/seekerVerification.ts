import { Router } from "express";
import { storage } from "../storage";
import { requireAdminSession } from "../middleware/requireAdminSession";
import { z } from "zod";
import type { SeekerCredentialRequirement, SeekerRequirementRule } from "@shared/schema";

export const seekerVerificationRouter = Router();

function requireSeekerSession(req: any, res: any): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ ok: false, error: "unauthenticated" });
    return false;
  }
  if (req.user.role !== "job_seeker") {
    res.status(403).json({ ok: false, error: "forbidden", message: "Job seeker access required" });
    return false;
  }
  return true;
}

function isValidHttpUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function computeRequirements(
  allRequirements: SeekerCredentialRequirement[],
  allRules: SeekerRequirementRule[],
  userTrack: string | null | undefined,
  appliedJobTags: string[],
  employerCategory?: string | null,
  jobState?: string | null
): SeekerCredentialRequirement[] {
  const matched = new Set<string>();
  for (const rule of allRules) {
    if (rule.conditionType === "track" && userTrack && userTrack.toLowerCase() === rule.conditionValue.toLowerCase()) {
      matched.add(rule.requirementKey);
    }
    if (rule.conditionType === "job_tag") {
      if (appliedJobTags.some(t => t.toLowerCase() === rule.conditionValue.toLowerCase())) {
        matched.add(rule.requirementKey);
      }
    }
    if (rule.conditionType === "employer_category" && employerCategory && employerCategory.toLowerCase() === rule.conditionValue.toLowerCase()) {
      matched.add(rule.requirementKey);
    }
    if (rule.conditionType === "job_state" && jobState && jobState.toLowerCase() === rule.conditionValue.toLowerCase()) {
      matched.add(rule.requirementKey);
    }
  }
  return allRequirements.filter(r => matched.has(r.key));
}

export async function computeRequirementsForSeeker(
  userTrack: string | null | undefined,
  jobTags?: string[],
  employerCategory?: string | null,
  jobState?: string | null
): Promise<SeekerCredentialRequirement[]> {
  const allReqs = await storage.getSeekerCredentialRequirements();
  const allRules = await storage.getSeekerRequirementRules();
  return computeRequirements(allReqs, allRules, userTrack, jobTags || [], employerCategory, jobState);
}

const SEED_REQUIREMENTS = [
  { key: "cdl_a", label: "CDL-A (Class A Commercial Driver's License)", description: "Required for operating tractor-trailers and large combination vehicles", category: "license" },
  { key: "cdl_b", label: "CDL-B (Class B Commercial Driver's License)", description: "Required for operating straight trucks, large buses, and segmented buses", category: "license" },
  { key: "hazmat_endorsement", label: "Hazmat Endorsement (HME)", description: "Required for transporting hazardous materials", category: "endorsement" },
  { key: "twic", label: "TWIC (Transportation Worker ID Credential)", description: "Required for unescorted access to secure areas of maritime facilities and vessels", category: "credential" },
  { key: "forklift_cert", label: "Forklift Operator Certification", description: "OSHA-compliant certification for powered industrial truck operation", category: "certification" },
  { key: "icao_iata_training", label: "ICAO/IATA Dangerous Goods Training", description: "Required for handling and shipping dangerous goods by air", category: "training" },
  { key: "msha_part48", label: "MSHA Part 48 Training", description: "Mine Safety and Health Administration surface/underground training", category: "training" },
];

const SEED_RULES = [
  { requirementKey: "cdl_a", conditionType: "track", conditionValue: "OTR Driver" },
  { requirementKey: "cdl_a", conditionType: "track", conditionValue: "Regional Driver" },
  { requirementKey: "cdl_b", conditionType: "track", conditionValue: "Local Driver" },
  { requirementKey: "hazmat_endorsement", conditionType: "job_tag", conditionValue: "hazmat" },
  { requirementKey: "twic", conditionType: "job_tag", conditionValue: "marine" },
  { requirementKey: "twic", conditionType: "job_tag", conditionValue: "port" },
  { requirementKey: "twic", conditionType: "employer_category", conditionValue: "maritime" },
  { requirementKey: "twic", conditionType: "employer_category", conditionValue: "marine" },
  { requirementKey: "forklift_cert", conditionType: "track", conditionValue: "Warehouse" },
  { requirementKey: "forklift_cert", conditionType: "job_tag", conditionValue: "forklift" },
  { requirementKey: "icao_iata_training", conditionType: "job_tag", conditionValue: "air_freight" },
  { requirementKey: "icao_iata_training", conditionType: "employer_category", conditionValue: "aviation" },
  { requirementKey: "msha_part48", conditionType: "track", conditionValue: "Mining" },
];

let _seedCompleted = false;
export async function seedSeekerCredentialData() {
  if (_seedCompleted) return;
  try {
    const existingReqs = await storage.getSeekerCredentialRequirements();
    const existingRules = await storage.getSeekerRequirementRules();
    const existingReqKeys = new Set(existingReqs.map(r => r.key));
    const existingRuleKeys = new Set(existingRules.map(r => `${r.requirementKey}:${r.conditionType}:${r.conditionValue}`));
    const missingReqs = SEED_REQUIREMENTS.filter(r => !existingReqKeys.has(r.key));
    const missingRules = SEED_RULES.filter(r => !existingRuleKeys.has(`${r.requirementKey}:${r.conditionType}:${r.conditionValue}`));
    if (missingReqs.length === 0 && missingRules.length === 0) {
      _seedCompleted = true;
      return;
    }
    for (const req of missingReqs) {
      await storage.upsertSeekerCredentialRequirement(req);
    }
    for (const rule of missingRules) {
      await storage.upsertSeekerRequirementRule(rule);
    }
    _seedCompleted = true;
    console.log("[seeker-verification] Seeded credential data", { reqs: missingReqs.length, rules: missingRules.length });
  } catch (err) {
    console.error("[seeker-verification] Seed error:", err);
  }
}

seekerVerificationRouter.get("/api/seeker/verification/requirements", async (req, res) => {
  if (!requireSeekerSession(req, res)) return;
  try {
    const allReqs = await storage.getSeekerCredentialRequirements();
    const allRules = await storage.getSeekerRequirementRules();
    const user = req.user as any;
    const jobIdParam = req.query.jobId ? Number(req.query.jobId) : null;
    let jobTags: string[] = [];
    let employerCategory: string | null = null;
    let jobState: string | null = null;
    if (jobIdParam) {
      const job = await storage.getJob(jobIdParam);
      if (job) {
        if (job.tags) jobTags = job.tags.filter((t): t is string => !!t);
        jobState = job.locationState || null;
        const employer = await storage.getUser(job.employerId);
        if (employer) employerCategory = employer.employerCategory || null;
      }
    }
    const computed = computeRequirements(allReqs, allRules, user.seekerTrack, jobTags, employerCategory, jobState);
    res.json({ requirements: computed, allRequirements: allReqs });
  } catch (err) {
    console.error("[SeekerVerification] requirements error:", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

seekerVerificationRouter.get("/api/seeker/verification/request", async (req, res) => {
  if (!requireSeekerSession(req, res)) return;
  try {
    const request = await storage.getLatestSeekerVerificationRequest(req.user.id);
    if (!request) {
      return res.json({ request: null, evidence: [] });
    }
    const evidence = await storage.getSeekerEvidenceItemsByRequest(request.id);
    res.json({ request, evidence });
  } catch (err) {
    console.error("[SeekerVerification] get request error:", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

seekerVerificationRouter.post("/api/seeker/verification/request/get-or-create", async (req, res) => {
  if (!requireSeekerSession(req, res)) return;
  try {
    const request = await storage.getOrCreateSeekerVerificationRequest(req.user.id);
    const user = req.user as any;
    const jobId = req.body?.jobId ? Number(req.body.jobId) : null;
    let jobTags: string[] = [];
    let employerCategory: string | null = null;
    let jobState: string | null = null;
    if (jobId) {
      const job = await storage.getJob(jobId);
      if (job) {
        if (job.tags) jobTags = job.tags.filter((t): t is string => !!t);
        jobState = job.locationState || null;
        const employer = await storage.getUser(job.employerId);
        if (employer) employerCategory = employer.employerCategory || null;
      }
    }
    const computed = await computeRequirementsForSeeker(user.seekerTrack, jobTags, employerCategory, jobState);
    const keys = computed.map(r => r.key);
    if (keys.length > 0) {
      await storage.appendRequirementsSnapshot(request.id, keys);
    }
    const updated = await storage.getActiveSeekerVerificationRequest(req.user.id);
    const evidence = await storage.getSeekerEvidenceItemsByRequest(request.id);
    res.json({ request: updated || request, evidence });
  } catch (err) {
    console.error("[SeekerVerification] get-or-create error:", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

seekerVerificationRouter.post("/api/seeker/verification/request/append-requirements", async (req, res) => {
  if (!requireSeekerSession(req, res)) return;
  try {
    const { jobId } = z.object({ jobId: z.number() }).parse(req.body);
    const user = req.user as any;
    const job = await storage.getJob(jobId);
    if (!job) {
      return res.status(404).json({ ok: false, error: "job_not_found" });
    }
    const jobTags = (job.tags || []).filter((t): t is string => !!t);
    let employerCategory: string | null = null;
    const employer = await storage.getUser(job.employerId);
    if (employer) employerCategory = employer.employerCategory || null;
    const jobState = job.locationState || null;
    const computed = await computeRequirementsForSeeker(user.seekerTrack, jobTags, employerCategory, jobState);
    const keys = computed.map(r => r.key);
    if (keys.length === 0) {
      const request = await storage.getActiveSeekerVerificationRequest(user.id);
      return res.json({ request, appended: [] });
    }
    let request = await storage.getOrCreateSeekerVerificationRequest(user.id);
    const updated = await storage.appendRequirementsSnapshot(request.id, keys);
    res.json({ request: updated, appended: keys });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ ok: false, error: "validation_error", message: err.errors[0].message });
    }
    console.error("[SeekerVerification] append-requirements error:", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

const seekerEvidenceSchema = z.object({
  requestId: z.number(),
  requirementKey: z.string().min(1),
  sourceType: z.string().min(1),
  sourceUrl: z.string().optional().nullable().refine(
    (val) => !val || isValidHttpUrl(val),
    { message: "Source URL must be a valid http or https URL" }
  ),
  excerpt: z.string().optional().nullable(),
  claim: z.string().optional().nullable(),
});

seekerVerificationRouter.post("/api/seeker/verification/evidence", async (req, res) => {
  if (!requireSeekerSession(req, res)) return;
  try {
    const parsed = seekerEvidenceSchema.parse(req.body);
    const request = await storage.getActiveSeekerVerificationRequest(req.user.id);
    if (!request || request.id !== parsed.requestId) {
      return res.status(400).json({ ok: false, error: "invalid_request", message: "No active verification request found" });
    }
    if (request.status === "submitted") {
      return res.status(400).json({ ok: false, error: "already_submitted", message: "Request already submitted" });
    }
    const allReqs = await storage.getSeekerCredentialRequirements();
    const validKeys = new Set(allReqs.map(r => r.key));
    if (!validKeys.has(parsed.requirementKey)) {
      return res.status(400).json({ ok: false, error: "invalid_requirement_key", message: `Unknown credential key: ${parsed.requirementKey}` });
    }
    const item = await storage.createSeekerEvidenceItem(parsed);
    res.status(201).json(item);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ ok: false, error: "validation_error", message: err.errors[0].message });
    }
    console.error("[SeekerVerification] evidence error:", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

seekerVerificationRouter.post("/api/seeker/verification/request/submit", async (req, res) => {
  if (!requireSeekerSession(req, res)) return;
  try {
    const request = await storage.getActiveSeekerVerificationRequest(req.user.id);
    if (!request) {
      return res.status(400).json({ ok: false, error: "no_request", message: "No active verification request found" });
    }
    if (request.status === "submitted") {
      return res.status(400).json({ ok: false, error: "already_submitted", message: "Already submitted" });
    }
    const evidence = await storage.getSeekerEvidenceItemsByRequest(request.id);
    if (evidence.length === 0) {
      return res.status(400).json({ ok: false, error: "no_evidence", message: "Please add at least one evidence item before submitting" });
    }
    const snapshot = request.requirementsSnapshot || [];
    if (snapshot.length > 0) {
      const evidenceKeys = new Set(evidence.map(e => e.requirementKey));
      const missing = snapshot.filter(k => !evidenceKeys.has(k));
      if (missing.length > 0) {
        return res.status(400).json({
          ok: false,
          error: "incomplete_evidence",
          message: `Missing evidence for required credentials: ${missing.join(", ")}`,
          missingKeys: missing,
        });
      }
    }
    const updated = await storage.updateSeekerVerificationRequestStatus(request.id, "submitted");
    res.json({ request: updated });
  } catch (err) {
    console.error("[SeekerVerification] submit error:", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

seekerVerificationRouter.get("/api/admin/seeker-verification/inbox", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const requests = await storage.getSeekerVerificationRequestsByStatus(["submitted", "needs_more"]);
    const allReqs = await storage.getSeekerCredentialRequirements();
    const reqMap = Object.fromEntries(allReqs.map(r => [r.key, r.label]));
    const withEvidence = await Promise.all(
      requests.map(async (r) => ({
        ...r,
        evidence: await storage.getSeekerEvidenceItemsByRequest(r.id),
        requirementLabels: (r.requirementsSnapshot || []).map(k => reqMap[k] || k),
      }))
    );
    res.json(withEvidence);
  } catch (err) {
    console.error("[SeekerVerification] inbox error:", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

const seekerDecisionSchema = z.object({
  requestId: z.number(),
  decision: z.enum(["verified", "rejected", "needs_more"]),
  adminNotes: z.string().optional(),
});

seekerVerificationRouter.post("/api/admin/seeker-verification/request/decision", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const parsed = seekerDecisionSchema.parse(req.body);
    const adminId = (req as any).user.id;
    const updated = await storage.updateSeekerVerificationRequestStatus(
      parsed.requestId,
      parsed.decision,
      parsed.adminNotes,
      adminId
    );
    if (parsed.decision === "verified") {
      await storage.updateSeekerVerificationStatus(updated.seekerId, "verified");
    } else if (parsed.decision === "rejected") {
      await storage.updateSeekerVerificationStatus(updated.seekerId, "rejected");
    } else if (parsed.decision === "needs_more") {
      await storage.updateSeekerVerificationStatus(updated.seekerId, "needs_more");
    }
    res.json({ request: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ ok: false, error: "validation_error", message: err.errors[0].message });
    }
    console.error("[SeekerVerification] decision error:", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});
