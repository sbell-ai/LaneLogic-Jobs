import type { Request, Response, NextFunction } from "express";

export function requireAdminSecret(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.ADMIN_SYNC_SECRET;
  if (!secret) {
    return res.status(500).json({ ok: false, error: "ADMIN_SYNC_SECRET not set" });
  }

  const provided = req.header("x-admin-sync-secret");
  if (!provided || provided !== secret) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }

  next();
}