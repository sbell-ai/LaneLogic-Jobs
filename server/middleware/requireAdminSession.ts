import type { Request, Response } from "express";

export function requireAdminSession(req: Request, res: Response): boolean {
  const user = (req as any).user;
  if (!req.isAuthenticated() || !user || user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}
