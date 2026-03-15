// server/routes/admin.ts
import { Router } from "express";
import { requireAdminSecret } from "../middleware/requireAdminSecret.ts";
import { syncDesignSystemSecurity } from "../registry/syncDesignSystemSecurity.ts";
import { syncEmployers } from "../registry/syncEmployers.ts";
import { loadEmployerRegistry } from "../registry/employerRegistryLoader.ts";

export const adminRouter = Router();

// Require secret for EVERYTHING under /admin
adminRouter.use(requireAdminSecret);

adminRouter.post("/registry-sync/design-system-security", async (req, res) => {
  try {
    const environment = process.env.NODE_ENV === "production" ? "prod" : "staging";
    const result = await syncDesignSystemSecurity({ environment });
    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});
adminRouter.post("/registry-sync/employers", async (req, res) => {
  try {
    const environment = process.env.NODE_ENV === "production" ? "prod" : "staging";
    const result = await syncEmployers({ environment });
    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

adminRouter.get("/registry/employers", async (req, res) => {
  try {
    const environment = process.env.NODE_ENV === "production" ? "prod" : "staging";
    const result = await loadEmployerRegistry(environment);
    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});