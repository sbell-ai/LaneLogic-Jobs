// Sprint 7 — Admin API for the AI job-seeding agent.
//
//   POST /api/admin/seed/run         fire-and-forget agent invocation
//   GET  /api/admin/seed/logs        paginated run history (newest first)
//   GET  /api/admin/seed/logs/:id    single run + per_source + error_log
//
// All endpoints are session-gated to role=admin via requireAdminSession.

import { Router } from "express";
import { desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "../db";
import { seedLog } from "@shared/schema";
import { requireAdminSession } from "../middleware/requireAdminSession";
import {
  requestCancel,
  runSeedAgentForExistingLog,
  startSeedRun,
} from "../lib/seedAgent";
import type { SeedErrorEntry } from "../../shared/seedTypes";

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

// ─── POST /api/admin/seed/cancel ────────────────────────────────────────────
//
// Cancels an in-flight run. With `{log_id}` in the body, cancels that
// specific row; without one, cancels the most recent row whose `completed_at`
// is still NULL.
//
// Two writes happen:
//   1. In-memory cancellation flag — the orchestrator checks this between
//      sources and between postings, then bails into a normal finalize that
//      records the cancel marker in `error_log`.
//   2. Eager DB write — sets `completed_at` and appends a cancel marker to
//      `error_log`. This is the safety net for the dead-agent case (server
//      restart killed the process; the row would otherwise stay uncompleted
//      forever). If the agent is alive, its Phase 3 UPDATE will overwrite
//      this — same final shape, no duplicates.

router.post("/api/admin/seed/cancel", async (req, res) => {
  if (!requireAdminSession(req, res)) return;

  const explicitId = Number(req.body?.log_id);
  let targetId: number;

  if (Number.isFinite(explicitId) && explicitId > 0) {
    targetId = explicitId;
  } else {
    const [active] = await db
      .select({ id: seedLog.id })
      .from(seedLog)
      .where(isNull(seedLog.completedAt))
      .orderBy(desc(seedLog.startedAt))
      .limit(1);
    if (!active) {
      return res.status(404).json({ error: "no active run to cancel" });
    }
    targetId = active.id;
  }

  const [row] = await db
    .select()
    .from(seedLog)
    .where(eq(seedLog.id, targetId))
    .limit(1);
  if (!row) {
    return res.status(404).json({ error: "log row not found", log_id: targetId });
  }
  if (row.completedAt) {
    return res
      .status(409)
      .json({ error: "run already completed", log_id: targetId });
  }

  requestCancel(targetId);

  const existing: SeedErrorEntry[] = Array.isArray(row.errorLog)
    ? (row.errorLog as SeedErrorEntry[])
    : [];
  const cancelMarker: SeedErrorEntry = {
    source: "admin",
    url: "",
    error: "cancelled by admin",
  };

  try {
    await db
      .update(seedLog)
      .set({
        completedAt: new Date(),
        errorLog: [...existing, cancelMarker],
      } as any)
      .where(eq(seedLog.id, targetId));
  } catch (err) {
    console.error("[seedAdmin] cancel UPDATE failed:", err);
    return res.status(500).json({ error: "failed to mark cancelled" });
  }

  res.json({ log_id: targetId, cancelled: true });
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
