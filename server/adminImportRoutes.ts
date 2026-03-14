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
  app.get("/api/admin/imports/sources", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const sources = await storage.getJobSources();
      res.json(sources);
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
      const { actorInputJson, pollIntervalMinutes, status, name } = req.body;
      const updates: any = {};
      if (actorInputJson !== undefined) updates.actorInputJson = actorInputJson;
      if (pollIntervalMinutes !== undefined) updates.pollIntervalMinutes = pollIntervalMinutes;
      if (status !== undefined) updates.status = status;
      if (name !== undefined) updates.name = name;
      const source = await storage.updateJobSource(Number(req.params.id), updates);
      res.json(source);
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

  app.get("/api/admin/imports/targets", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const sourceId = req.query.sourceId ? Number(req.query.sourceId as string) : undefined;
      const targets = await storage.getImportTargets(sourceId);

      const targetsWithCounts = await Promise.all(targets.map(async (t) => {
        const jobCount = await storage.getJobCountByImportTarget(t.id);
        return { ...t, jobCount };
      }));

      res.json(targetsWithCounts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/admin/imports/targets/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { status, expireAll } = req.body;
      const id = Number(req.params.id);
      const target = await storage.getImportTarget(id);
      if (!target) return res.status(404).json({ error: "Target not found" });

      const updated = await storage.updateImportTarget(id, { status });

      if (status === "blocked" && expireAll) {
        const expired = await storage.expireJobsByImportTarget(id);
        return res.json({ ...updated, expiredCount: expired });
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/imports/runs", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const sourceId = req.query.sourceId ? Number(req.query.sourceId as string) : undefined;
      const limit = req.query.limit ? Number(req.query.limit as string) : 50;
      const runs = await storage.getJobImportRuns(sourceId, limit);
      res.json(runs);
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
