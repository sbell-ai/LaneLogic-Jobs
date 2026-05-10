// Sprint 5 — seeker-facing /api/matches endpoints.
//   GET  /api/matches          paginated list of cached match_scores rows
//   GET  /api/matches/:jobId   single match detail with breakdown + gaps
//   POST /api/matches/compute  recompute scores for the authenticated seeker
//                              (or for a specific job if {jobId} is passed —
//                              this branch is what the Sprint 4 matchRecalc
//                              hook drives, recomputing every seeker for one
//                              job).

import { Router } from "express";
import { z } from "zod";
import {
  getMatchDetail,
  listMatchesForSeeker,
  recomputeForJob,
  recomputeForSeeker,
  topGapForSeeker,
  type ListMatchesOptions,
} from "../lib/matchScoreCache";
import type { MatchListResponse } from "@shared/matchTypes";

const router = Router();

function requireSeeker(req: any, res: any): { id: number } | null {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  const user = req.user as { id: number; role: string };
  if (user.role !== "job_seeker" && user.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return { id: user.id };
}

// ─── GET /api/matches ────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  sort: z.enum(["score", "experience", "location"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  min_score: z.coerce.number().int().min(0).max(100).optional(),
  has_disqualifier: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

router.get("/api/matches", async (req, res) => {
  const auth = requireSeeker(req, res);
  if (!auth) return;
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });
  }
  try {
    const opts: ListMatchesOptions = {
      sort: parsed.data.sort,
      order: parsed.data.order,
      minScore: parsed.data.min_score,
      hideDisqualified: parsed.data.has_disqualifier === "false",
      page: parsed.data.page,
      limit: parsed.data.limit,
    };
    const { matches, total } = await listMatchesForSeeker(auth.id, opts);
    const top_gap = await topGapForSeeker(auth.id);
    const body: MatchListResponse = {
      matches,
      page: opts.page ?? 1,
      limit: opts.limit ?? 20,
      total,
      top_gap,
    };
    return res.json(body);
  } catch (err) {
    console.error("GET /api/matches error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/matches/:jobId ─────────────────────────────────────────────────

router.get("/api/matches/:jobId", async (req, res) => {
  const auth = requireSeeker(req, res);
  if (!auth) return;
  const jobId = parseInt(req.params.jobId, 10);
  if (!Number.isFinite(jobId)) {
    return res.status(400).json({ error: "Invalid job ID" });
  }
  try {
    const detail = await getMatchDetail(auth.id, jobId);
    if (!detail) return res.status(404).json({ error: "Match not found" });
    return res.json(detail);
  } catch (err) {
    console.error("GET /api/matches/:jobId error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/matches/compute ───────────────────────────────────────────────

const computeBodySchema = z.object({
  jobId: z.number().int().positive().optional(),
});

router.post("/api/matches/compute", async (req, res) => {
  const auth = requireSeeker(req, res);
  if (!auth) return;
  const parsed = computeBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
  }
  try {
    if (parsed.data.jobId) {
      // Admin/system path: recompute one job for all seekers. Restrict to
      // admin users — regular seekers shouldn't be able to fan out work
      // across the whole user base.
      const user = req.user as { role: string };
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }
      const r = await recomputeForJob(parsed.data.jobId);
      return res.json({ scope: "job", jobId: parsed.data.jobId, ...r });
    }
    const r = await recomputeForSeeker(auth.id);
    return res.json({ scope: "seeker", seekerId: auth.id, ...r });
  } catch (err) {
    console.error("POST /api/matches/compute error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
