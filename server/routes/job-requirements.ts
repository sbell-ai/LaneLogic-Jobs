import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import {
  credentialTypes,
  jobCredentialRequirements,
  REQUIREMENT_LEVELS,
  type RequirementLevel,
} from "@shared/schema";
import { recalculateMatchScoresForJob } from "../utils/matchRecalc";

const router = Router();

const createBodySchema = z.object({
  credential_type_id: z.number().int().positive(),
  requirement_level: z.enum(REQUIREMENT_LEVELS),
  notes: z.string().max(500).nullish(),
});

const updateBodySchema = z.object({
  requirement_level: z.enum(REQUIREMENT_LEVELS).optional(),
  notes: z.string().max(500).nullable().optional(),
});

async function loadJobOrError(jobId: number, res: any): Promise<any | null> {
  if (!Number.isFinite(jobId)) {
    res.status(400).json({ error: "Invalid job ID" });
    return null;
  }
  const job = await storage.getJob(jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return null;
  }
  return job;
}

function requireOwner(req: any, res: any, job: { employerId: number }): { user: any } | null {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  const user = req.user as { id: number; role: string };
  if (user.role !== "admin" && job.employerId !== user.id) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return { user };
}

// GET /api/jobs/:jobId/requirements
router.get("/api/jobs/:jobId/requirements", async (req, res) => {
  const jobId = parseInt(req.params.jobId, 10);
  const job = await loadJobOrError(jobId, res);
  if (!job) return;

  try {
    const rows = await db
      .select({
        id: jobCredentialRequirements.id,
        job_id: jobCredentialRequirements.jobId,
        credential_type_id: jobCredentialRequirements.credentialTypeId,
        requirement_level: jobCredentialRequirements.requirementLevel,
        notes: jobCredentialRequirements.notes,
        created_at: jobCredentialRequirements.createdAt,
        credential_type: {
          id: credentialTypes.id,
          modal_namespace: credentialTypes.modalNamespace,
          code: credentialTypes.code,
          name: credentialTypes.name,
          description: credentialTypes.description,
          issuing_authority: credentialTypes.issuingAuthority,
          has_expiry: credentialTypes.hasExpiry,
          verification_method: credentialTypes.verificationMethod,
          is_active: credentialTypes.isActive,
        },
      })
      .from(jobCredentialRequirements)
      .innerJoin(credentialTypes, eq(jobCredentialRequirements.credentialTypeId, credentialTypes.id))
      .where(eq(jobCredentialRequirements.jobId, jobId));

    return res.json(rows);
  } catch (err) {
    console.error("GET /api/jobs/:jobId/requirements error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/jobs/:jobId/requirements
router.post("/api/jobs/:jobId/requirements", async (req, res) => {
  const jobId = parseInt(req.params.jobId, 10);
  const job = await loadJobOrError(jobId, res);
  if (!job) return;
  if (!requireOwner(req, res, job)) return;

  const parsed = createBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
  }

  try {
    const credType = await db
      .select()
      .from(credentialTypes)
      .where(eq(credentialTypes.id, parsed.data.credential_type_id))
      .limit(1);
    if (credType.length === 0 || !credType[0].isActive) {
      return res.status(400).json({ error: "Invalid credential_type_id" });
    }

    const [row] = await db
      .insert(jobCredentialRequirements)
      .values({
        jobId,
        credentialTypeId: parsed.data.credential_type_id,
        requirementLevel: parsed.data.requirement_level as RequirementLevel,
        notes: parsed.data.notes ?? null,
      })
      .returning();

    await recalculateMatchScoresForJob(jobId);
    return res.status(201).json(row);
  } catch (err: any) {
    const pgCode = err?.code ?? err?.cause?.code;
    if (pgCode === "23505") {
      return res.status(409).json({ error: "Credential already required for this job" });
    }
    console.error("POST /api/jobs/:jobId/requirements error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/jobs/:jobId/requirements/:id
router.patch("/api/jobs/:jobId/requirements/:id", async (req, res) => {
  const jobId = parseInt(req.params.jobId, 10);
  const reqId = parseInt(req.params.id, 10);
  const job = await loadJobOrError(jobId, res);
  if (!job) return;
  if (!requireOwner(req, res, job)) return;

  const parsed = updateBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
  }

  const updates: { requirementLevel?: RequirementLevel; notes?: string | null } = {};
  if (parsed.data.requirement_level !== undefined) updates.requirementLevel = parsed.data.requirement_level;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No updatable fields provided" });
  }

  try {
    const [row] = await db
      .update(jobCredentialRequirements)
      .set(updates)
      .where(
        and(
          eq(jobCredentialRequirements.id, reqId),
          eq(jobCredentialRequirements.jobId, jobId),
        ),
      )
      .returning();
    if (!row) return res.status(404).json({ error: "Requirement not found" });

    await recalculateMatchScoresForJob(jobId);
    return res.json(row);
  } catch (err) {
    console.error("PATCH /api/jobs/:jobId/requirements/:id error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/jobs/:jobId/requirements/:id
router.delete("/api/jobs/:jobId/requirements/:id", async (req, res) => {
  const jobId = parseInt(req.params.jobId, 10);
  const reqId = parseInt(req.params.id, 10);
  const job = await loadJobOrError(jobId, res);
  if (!job) return;
  if (!requireOwner(req, res, job)) return;

  try {
    const [row] = await db
      .delete(jobCredentialRequirements)
      .where(
        and(
          eq(jobCredentialRequirements.id, reqId),
          eq(jobCredentialRequirements.jobId, jobId),
        ),
      )
      .returning();
    if (!row) return res.status(404).json({ error: "Requirement not found" });

    await recalculateMatchScoresForJob(jobId);
    return res.status(204).send();
  } catch (err) {
    console.error("DELETE /api/jobs/:jobId/requirements/:id error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
