import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";

export function requireAdminSecret(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.ADMIN_SYNC_SECRET;

  // Misconfig should hard-fail. Never run admin endpoints unprotected.
  if (!secret) {
    return res.status(500).json({ ok: false, error: "ADMIN_SYNC_SECRET not set" });
  }

  const provided = req.header("x-admin-sync-secret");

  // Missing credentials is a 401 (clearer than 403 for debugging).
  if (!provided) {
    return res.status(401).json({ ok: false, error: "Missing admin secret" });
  }

  // Timing-safe compare to avoid subtle leakage.
  const secretBuf = Buffer.from(secret);
  const providedBuf = Buffer.from(provided);

  const matches =
    secretBuf.length === providedBuf.length &&
    crypto.timingSafeEqual(secretBuf, providedBuf);

  if (!matches) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }

  return next();
}