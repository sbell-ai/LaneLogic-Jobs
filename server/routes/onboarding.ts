// Sprint 6 — onboarding endpoints. Each step writes independently so the
// wizard can save and proceed without all-or-nothing risk.
//
//   PATCH /api/onboarding/seeker/credentials   — codes[] → seekerCertProfiles
//   PATCH /api/onboarding/seeker/experience    — years/lat/lng
//   PATCH /api/onboarding/seeker/preferences   — users.seekerPreferences
//   POST  /api/onboarding/seeker/complete      — sets onboarding_completed_at
//                                                + recomputes match scores
//
//   PATCH /api/onboarding/employer/company     — company fields + lat/lng
//                                                + primary_modal
//   POST  /api/onboarding/employer/complete    — sets onboarding_completed_at

import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  users,
  seekerCertProfiles,
  MODAL_NAMESPACES,
  type SeekerPreferencesData,
} from "@shared/schema";
import type { CdlClass, CdlEndorsement } from "@shared/certEnums";
import { recomputeForSeeker } from "../lib/matchScoreCache";

const router = Router();

function requireAuthRole(req: any, res: any, role: "job_seeker" | "employer"): { id: number } | null {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  const u = req.user as { id: number; role: string };
  if (u.role !== role && u.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return { id: u.id };
}

// ─── Seeker credential mapping ───────────────────────────────────────────────
// Translate Sprint 4 credential codes (e.g. CDL_CLASS_A, END_HAZMAT) into the
// CDL-shaped fields on seekerCertProfiles. Codes without a CDL field
// equivalent (TWIC, MED_CERT_2YR, HAZMAT_TRAINING, CLEAN_MVR) have no
// storage destination yet — they're silently skipped.

const CODE_TO_ENDORSEMENT: Record<string, CdlEndorsement> = {
  END_HAZMAT: "H",
  END_TANKER: "N",
  END_DOUBLES: "T",
  END_PASSENGER: "P",
  END_SCHOOL_BUS: "S",
};

const CDL_CLASS_PRIORITY: CdlClass[] = ["A", "B", "C"];

function applyCodesToProfile(codes: string[]): {
  cdlClass: CdlClass | null;
  cdlEndorsements: CdlEndorsement[];
  hasHazmat: boolean;
  hasTanker: boolean;
  hasDoubleTriple: boolean;
  hasPassenger: boolean;
  hasSchoolBus: boolean;
} {
  const endorsements = new Set<CdlEndorsement>();
  const declaredClasses: CdlClass[] = [];
  for (const code of codes) {
    const cls = code.match(/^CDL_CLASS_([ABC])$/)?.[1] as CdlClass | undefined;
    if (cls) declaredClasses.push(cls);
    const endorsement = CODE_TO_ENDORSEMENT[code];
    if (endorsement) endorsements.add(endorsement);
  }
  // If multiple classes were checked, take the most general (A > B > C).
  const cdlClass = CDL_CLASS_PRIORITY.find((c) => declaredClasses.includes(c)) ?? null;
  return {
    cdlClass,
    cdlEndorsements: Array.from(endorsements),
    hasHazmat: endorsements.has("H"),
    hasTanker: endorsements.has("N"),
    hasDoubleTriple: endorsements.has("T"),
    hasPassenger: endorsements.has("P"),
    hasSchoolBus: endorsements.has("S"),
  };
}

async function upsertSeekerCertProfile(userId: number, patch: Partial<{
  cdlClass: CdlClass | null;
  cdlEndorsements: CdlEndorsement[];
  hasHazmat: boolean;
  hasTanker: boolean;
  hasDoubleTriple: boolean;
  hasPassenger: boolean;
  hasSchoolBus: boolean;
  yearsExperience: number | null;
}>) {
  const existingRows = await db
    .select()
    .from(seekerCertProfiles)
    .where(eq(seekerCertProfiles.userId, userId))
    .limit(1);
  const existing = existingRows[0];
  if (existing) {
    await db
      .update(seekerCertProfiles)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(seekerCertProfiles.userId, userId));
    return;
  }
  await db.insert(seekerCertProfiles).values({
    userId,
    cdlClass: patch.cdlClass ?? null,
    cdlEndorsements: patch.cdlEndorsements ?? [],
    cdlRestrictions: [],
    yearsExperience: patch.yearsExperience ?? null,
    hasHazmat: patch.hasHazmat ?? false,
    hasTanker: patch.hasTanker ?? false,
    hasDoubleTriple: patch.hasDoubleTriple ?? false,
    hasPassenger: patch.hasPassenger ?? false,
    hasSchoolBus: patch.hasSchoolBus ?? false,
  });
}

// ─── Seeker: credentials ────────────────────────────────────────────────────

const credentialsBody = z.object({
  codes: z.array(z.string()).max(50),
});

router.patch("/api/onboarding/seeker/credentials", async (req, res) => {
  const auth = requireAuthRole(req, res, "job_seeker");
  if (!auth) return;
  const parsed = credentialsBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
  try {
    const patch = applyCodesToProfile(parsed.data.codes);
    await upsertSeekerCertProfile(auth.id, patch);
    return res.json({ ok: true, applied: patch });
  } catch (err) {
    console.error("PATCH /api/onboarding/seeker/credentials error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Seeker: experience + location ──────────────────────────────────────────

const experienceBody = z.object({
  years_experience: z.number().int().min(0).max(50).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
});

router.patch("/api/onboarding/seeker/experience", async (req, res) => {
  const auth = requireAuthRole(req, res, "job_seeker");
  if (!auth) return;
  const parsed = experienceBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
  try {
    if (parsed.data.years_experience !== undefined) {
      await upsertSeekerCertProfile(auth.id, { yearsExperience: parsed.data.years_experience ?? null });
    }
    const userPatch: { lat?: string | null; lng?: string | null } = {};
    if (parsed.data.lat !== undefined) userPatch.lat = parsed.data.lat == null ? null : String(parsed.data.lat);
    if (parsed.data.lng !== undefined) userPatch.lng = parsed.data.lng == null ? null : String(parsed.data.lng);
    if (Object.keys(userPatch).length > 0) {
      await db.update(users).set(userPatch).where(eq(users.id, auth.id));
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/onboarding/seeker/experience error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Seeker: preferences ────────────────────────────────────────────────────

const preferencesBody = z.object({
  job_types: z.array(z.enum(["full_time", "part_time", "contract", "owner_operator"])).default([]),
  modal_preferences: z.array(z.enum(MODAL_NAMESPACES)).default([]),
});

router.patch("/api/onboarding/seeker/preferences", async (req, res) => {
  const auth = requireAuthRole(req, res, "job_seeker");
  if (!auth) return;
  const parsed = preferencesBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
  try {
    const prefs: SeekerPreferencesData = {
      job_types: parsed.data.job_types,
      modal_preferences: parsed.data.modal_preferences,
    };
    await db.update(users).set({ seekerPreferences: prefs }).where(eq(users.id, auth.id));
    return res.json({ ok: true, preferences: prefs });
  } catch (err) {
    console.error("PATCH /api/onboarding/seeker/preferences error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Seeker: complete ───────────────────────────────────────────────────────

router.post("/api/onboarding/seeker/complete", async (req, res) => {
  const auth = requireAuthRole(req, res, "job_seeker");
  if (!auth) return;
  try {
    await db.update(users).set({ onboardingCompletedAt: new Date() }).where(eq(users.id, auth.id));
    // Compute initial matches with notifications suppressed — a freshly
    // onboarded seeker would otherwise get one new_match email per job ≥65
    // in a single burst. Subsequent recomputes (manual recompute, profile
    // edits) emit notifications normally.
    const compute = await recomputeForSeeker(auth.id, { suppressNotifications: true });
    return res.json({ ok: true, compute });
  } catch (err) {
    console.error("POST /api/onboarding/seeker/complete error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Employer: company ──────────────────────────────────────────────────────

const companyBody = z.object({
  company_name: z.string().max(200).nullable().optional(),
  dot_number: z.string().max(50).nullable().optional(),
  mc_number: z.string().max(50).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  primary_modal: z.enum(MODAL_NAMESPACES).nullable().optional(),
});

router.patch("/api/onboarding/employer/company", async (req, res) => {
  const auth = requireAuthRole(req, res, "employer");
  if (!auth) return;
  const parsed = companyBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
  try {
    const patch: Record<string, unknown> = {};
    if (parsed.data.company_name !== undefined) patch.companyName = parsed.data.company_name;
    if (parsed.data.dot_number !== undefined) patch.dotNumber = parsed.data.dot_number;
    if (parsed.data.mc_number !== undefined) patch.mcNumber = parsed.data.mc_number;
    if (parsed.data.lat !== undefined) patch.lat = parsed.data.lat == null ? null : String(parsed.data.lat);
    if (parsed.data.lng !== undefined) patch.lng = parsed.data.lng == null ? null : String(parsed.data.lng);
    if (parsed.data.primary_modal !== undefined) patch.primaryModal = parsed.data.primary_modal;
    if (Object.keys(patch).length === 0) return res.json({ ok: true });
    await db.update(users).set(patch).where(eq(users.id, auth.id));
    return res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/onboarding/employer/company error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Employer: complete ─────────────────────────────────────────────────────

router.post("/api/onboarding/employer/complete", async (req, res) => {
  const auth = requireAuthRole(req, res, "employer");
  if (!auth) return;
  try {
    await db.update(users).set({ onboardingCompletedAt: new Date() }).where(eq(users.id, auth.id));
    return res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/onboarding/employer/complete error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
