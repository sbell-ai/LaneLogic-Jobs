import type { Request, Response } from "express";

export function requireAdminSession(req: Request, res: Response): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ ok: false, error: "unauthenticated", message: "Authentication required" });
    return false;
  }
  const user = (req as any).user;
  if (!user || user.role !== "admin") {
    res.status(403).json({ ok: false, error: "forbidden", message: "Admin access required" });
    return false;
  }
  return true;
}
