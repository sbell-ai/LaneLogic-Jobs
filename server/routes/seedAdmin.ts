// Sprint 7 — Admin API for the AI job-seeding agent.
//
//   POST /api/admin/seed/run         fire-and-forget agent invocation
//   GET  /api/admin/seed/logs        paginated run history (newest first)
//   GET  /api/admin/seed/logs/:id    single run + per_source + error_log
//
// All endpoints are session-gated to role=admin via requireAdminSession.

import { Router } from "express";
import { desc, eq, sql } from "drizzle-orm";

import { db } from "../db";
import { seedLog } from "@shared/schema";
import { requireAdminSession } from "../middleware/requireAdminSession";
import { runSeedAgentForExistingLog, startSeedRun } from "../lib/seedAgent";

const router = Router();

// ─── POST /api/admin/seed/run ───────────────────────────────────────────────
//
// Returns immediately with the new log_id. The actual scrape+normalize+seed
// pipeline runs in the background — clients poll GET /logs/:id until the
// `completed_at` field flips from null to a timestamp.

router.post("/api/admin/seed/run", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  const adminUserId = (req.user as { id: number }).id;

  try {
    // Insert the log row synchronously so the response can include its id;
    // hand the id to the orchestrator's "adopt existing log" entry point so
    // we don't end up with two rows per run.
    const logId = await startSeedRun("admin", adminUserId);

    void runSeedAgentForExistingLog(logId).catch((err) => {
      console.error("[seedAdmin] background agent failed:", err);
    });

    res.json({
      log_id: logId,
      status: "started",
      message: "Seed agent running in background",
    });
  } catch (err) {
    console.error("[seedAdmin] failed to kick off run:", err);
    res.status(500).json({ error: "failed to start seed run" });
  }
});

// ─── GET /api/admin/seed/logs ───────────────────────────────────────────────
//
// Paginated history. Default page size 25, max 100.

router.get("/api/admin/seed/logs", async (req, res) => {
  if (!requireAdminSession(req, res)) return;

  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const offset = Math.max(0, Number(req.query.offset) || 0);

  try {
    const rows = await db
      .select({
        id: seedLog.id,
        startedAt: seedLog.startedAt,
        completedAt: seedLog.completedAt,
        triggeredBy: seedLog.triggeredBy,
        adminUserId: seedLog.adminUserId,
        totalScraped: seedLog.totalScraped,
        totalInserted: seedLog.totalInserted,
        totalSkipped: seedLog.totalSkipped,
        totalErrors: seedLog.totalErrors,
      })
      .from(seedLog)
      .orderBy(desc(seedLog.startedAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(seedLog);

    res.json({ rows, total: count, limit, offset });
  } catch (err) {
    console.error("[seedAdmin] log list failed:", err);
    res.status(500).json({ error: "failed to load logs" });
  }
});

// ─── GET /api/admin/seed/logs/:id ───────────────────────────────────────────

router.get("/api/admin/seed/logs/:id", async (req, res) => {
  if (!requireAdminSession(req, res)) return;

  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: "invalid log id" });
  }

  try {
    const [row] = await db
      .select()
      .from(seedLog)
      .where(eq(seedLog.id, id))
      .limit(1);
    if (!row) return res.status(404).json({ error: "not found" });
    res.json(row);
  } catch (err) {
    console.error("[seedAdmin] log fetch failed:", err);
    res.status(500).json({ error: "failed to load log" });
  }
});

export default router;
