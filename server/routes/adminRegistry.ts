import { Router } from "express";
import { requireAdminSession } from "../middleware/requireAdminSession.ts";
import { loadEmployerRegistry } from "../registry/employerRegistryLoader.ts";
import { syncEmployers } from "../registry/syncEmployers.ts";

const router = Router();

router.get("/api/admin/registry/employers", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const environment = process.env.NODE_ENV === "production" ? "prod" : "staging";
    res.json(await loadEmployerRegistry(environment));
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: String(err) });
  }
});

router.post("/api/admin/registry-sync/employers", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const environment = process.env.NODE_ENV === "production" ? "prod" : "staging";
    res.json(await syncEmployers({ environment }));
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: String(err) });
  }
});

export default router;
