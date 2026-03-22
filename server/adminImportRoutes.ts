import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { runImport } from "./import/importOrchestrator";

function requireAdmin(req: Request, res: Response): boolean {
  const user = (req as any).user;
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

export function registerAdminImportRoutes(app: Express) {
  // ─── Sources ──────────────────────────────────────────────────────────────

  app.get("/api/admin/imports/sources", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const sources = await storage.getJobSources();
      res.json(sources);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/imports/sources", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { name, actorId, actorInputJson, pollIntervalMinutes, status } = req.body;
      if (!name || !actorId) return res.status(400).json({ error: "name and actorId are required" });
      let parsedJson: any;
      try {
        parsedJson = typeof actorInputJson === "string" ? JSON.parse(actorInputJson) : actorInputJson;
      } catch {
        return res.status(400).json({ error: "actorInputJson must be valid JSON" });
      }
      const source = await storage.createJobSource({
        name,
        actorId,
        actorInputJson: parsedJson,
        pollIntervalMinutes: Number(pollIntervalMinutes) || 360,
        status: status || "active",
        provider: "apify",
      });
      res.status(201).json(source);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/imports/sources/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const source = await storage.getJobSource(Number(req.params.id));
      if (!source) return res.status(404).json({ error: "Source not found" });
      res.json(source);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/admin/imports/sources/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { actorInputJson, actorId, pollIntervalMinutes, status, name } = req.body;
      const updates: any = {};
      if (actorInputJson !== undefined) {
        try {
          updates.actorInputJson = typeof actorInputJson === "string" ? JSON.parse(actorInputJson) : actorInputJson;
        } catch {
          return res.status(400).json({ error: "actorInputJson must be valid JSON" });
        }
      }
      if (actorId !== undefined) updates.actorId = actorId;
      if (pollIntervalMinutes !== undefined) updates.pollIntervalMinutes = pollIntervalMinutes;
      if (status !== undefined) updates.status = status;
      if (name !== undefined) updates.name = name;
      const source = await storage.updateJobSource(Number(req.params.id), updates);
      res.json(source);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/admin/imports/sources/:id/toggle", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const source = await storage.getJobSource(Number(req.params.id));
      if (!source) return res.status(404).json({ error: "Source not found" });
      const newStatus = source.status === "active" ? "paused" : "active";
      const updated = await storage.updateJobSource(source.id, { status: newStatus });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/admin/imports/sources/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const id = Number(req.params.id);
      const source = await storage.getJobSource(id);
      if (!source) return res.status(404).json({ error: "Source not found" });
      const activeRuns = await storage.getActiveRunCountForSource(id);
      if (activeRuns > 0) {
        return res.status(409).json({ error: "Cannot delete source while a run is in progress" });
      }
      await storage.deleteJobSource(id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/imports/sources/:id/run", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const source = await storage.getJobSource(Number(req.params.id));
      if (!source) return res.status(404).json({ error: "Source not found" });
      const importTargetId = req.body.importTargetId ? Number(req.body.importTargetId) : undefined;

      res.json({ message: "Import run started", sourceId: source.id });

      runImport(source, importTargetId).catch(err => {
        console.error(`[import] Background run error for source ${source.id}:`, err);
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Targets ──────────────────────────────────────────────────────────────

  // Must register static sub-paths before /:id
  app.get("/api/admin/imports/targets/pending-count", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const count = await storage.getPendingImportTargetsCount();
      res.json({ count });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/imports/targets/bulk", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { ids, status } = req.body;
      if (!Array.isArray(ids) || !status) {
        return res.status(400).json({ error: "ids (array) and status are required" });
      }
      if (!["active", "rejected", "blocked"].includes(status)) {
        return res.status(400).json({ error: "status must be one of: active, rejected, blocked" });
      }
      const updated = await storage.bulkUpdateImportTargets(ids.map(Number), status);
      res.json({ updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/imports/targets", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const sourceId = req.query.sourceId ? Number(req.query.sourceId as string) : undefined;
      const targets = await storage.getImportTargetsWithSource(sourceId);
      res.json(targets);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/admin/imports/targets/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { status, expireAll, employerWebsiteDomain } = req.body;
      const id = Number(req.params.id);
      const target = await storage.getImportTarget(id);
      if (!target) return res.status(404).json({ error: "Target not found" });

      const updates: any = {};
      if (status !== undefined) updates.status = status;
      if (employerWebsiteDomain !== undefined) updates.employerWebsiteDomain = employerWebsiteDomain;

      const updated = await storage.updateImportTarget(id, updates);

      if (status === "blocked" && expireAll) {
        const expired = await storage.expireJobsByImportTarget(id);
        return res.json({ ...updated, expiredCount: expired });
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Runs ─────────────────────────────────────────────────────────────────

  // Must register /export and static paths BEFORE /:id
  app.get("/api/admin/imports/runs/export", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { sourceId, status, date_range } = req.query;
      const now = new Date();
      let dateFrom: Date | undefined;
      if (date_range === "today") dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      else if (date_range === "7d") { dateFrom = new Date(now); dateFrom.setDate(dateFrom.getDate() - 7); }
      else if (date_range === "30d") { dateFrom = new Date(now); dateFrom.setDate(dateFrom.getDate() - 30); }

      const { runs } = await storage.getJobImportRunsFiltered({
        sourceId: sourceId ? Number(sourceId) : undefined,
        status: status as string | undefined,
        dateFrom,
        page: 1,
        limit: 10000,
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=import-runs.csv");

      const header = "ID,Source,Status,Started At,Finished At,Duration (s),Created,Updated,Skipped,Expired,Apify Run ID,Error\n";
      const rows = runs.map(r => {
        const duration = r.startedAt && r.finishedAt
          ? Math.round((new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime()) / 1000)
          : "";
        const err = (r.lastError || "").replace(/"/g, '""');
        return `${r.id},"${r.sourceName}",${r.status},"${r.startedAt ? new Date(r.startedAt).toISOString() : ""}","${r.finishedAt ? new Date(r.finishedAt).toISOString() : ""}",${duration},${r.statsCreated},${r.statsUpdated},${r.statsSkipped},${r.statsExpired},"${r.apifyRunId || ""}","${err}"`;
      });
      res.send(header + rows.join("\n"));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/imports/runs", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { sourceId, status, date_range, page, limit } = req.query;
      const now = new Date();
      let dateFrom: Date | undefined;
      if (date_range === "today") dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      else if (date_range === "7d") { dateFrom = new Date(now); dateFrom.setDate(dateFrom.getDate() - 7); }
      else if (date_range === "30d") { dateFrom = new Date(now); dateFrom.setDate(dateFrom.getDate() - 30); }

      const pageNum = page ? Number(page) : 1;
      const limitNum = limit ? Number(limit) : 25;

      const result = await storage.getJobImportRunsFiltered({
        sourceId: sourceId ? Number(sourceId) : undefined,
        status: status as string | undefined,
        dateFrom,
        page: pageNum,
        limit: limitNum,
      });

      res.json({ runs: result.runs, total: result.total, page: pageNum, limit: limitNum });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/imports/runs/:id/jobs", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const run = await storage.getJobImportRun(Number(req.params.id));
      if (!run) return res.status(404).json({ error: "Run not found" });
      const jobs = await storage.getJobsForImportRun(Number(req.params.id));
      res.json(jobs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/imports/runs/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const run = await storage.getJobImportRun(Number(req.params.id));
      if (!run) return res.status(404).json({ error: "Run not found" });
      res.json(run);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
