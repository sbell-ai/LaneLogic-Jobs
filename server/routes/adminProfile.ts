import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import { storage } from "../storage";
import { pool } from "../db";
import { requireAdminSession } from "../middleware/requireAdminSession.ts";

const router = Router();

// ── Admin Profile API ─────────────────────────────────────────────────────

// GET /api/admin/profile — current admin's profile
router.get("/api/admin/profile", async (req: any, res) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const user = await storage.getUser(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    const { password, passwordResetToken, emailVerificationToken, ...safe } = user as any;
    res.json(safe);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch profile" });
  }
});

// PUT /api/admin/profile — update identity fields
router.put("/api/admin/profile", async (req: any, res) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const schema = z.object({
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      username: z.union([z.literal(""), z.string().min(2).max(40).regex(/^[a-zA-Z0-9_-]+$/, "Username may only contain letters, numbers, _ and -")]).optional().nullable().transform(v => (v === "" ? null : v)),
      email: z.string().email().optional(),
      contactPhone: z.string().optional().nullable(),
      profileImage: z.string().optional().nullable(),
    });
    const updates = schema.parse(req.body);
    const currentUser = await storage.getUser(req.user.id);
    if (!currentUser) return res.status(404).json({ message: "User not found" });

    const emailChanged = updates.email && updates.email !== currentUser.email;

    if (updates.username && updates.username !== currentUser.username) {
      const allAdmins = await storage.getAdminUsers();
      const taken = allAdmins.some(u => u.username === updates.username && u.id !== req.user.id);
      if (taken) return res.status(409).json({ message: "Username already taken" });
    }

    const updatePayload: any = { ...updates };
    if (emailChanged) {
      const token = randomUUID();
      updatePayload.emailVerificationToken = token;
      updatePayload.emailVerified = false;
      (async () => {
        try {
          const { sendTemplatedEmailByEvent } = await import("../email/sendTemplatedEmail.ts");
          const siteUrl = process.env.CANONICAL_HOST || "https://lanelogicjobs.com";
          await sendTemplatedEmailByEvent("email_verification", updates.email!, {
            first_name: currentUser.firstName || currentUser.email,
            verification_link: `${siteUrl}/verify-email?token=${token}`,
            expires_in: "7 days",
            site_name: "LaneLogic Jobs",
            site_url: siteUrl,
          });
        } catch {}
      })();
    }

    const updated = await storage.updateUser(req.user.id, updatePayload);
    const { password, passwordResetToken, emailVerificationToken, ...safe } = updated as any;
    res.json({ ...safe, emailChangePending: emailChanged ? true : undefined });
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message || "Validation error" });
    res.status(500).json({ message: "Failed to update profile" });
  }
});

// POST /api/admin/change-password
router.post("/api/admin/change-password", async (req: any, res) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const schema = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8, "New password must be at least 8 characters"),
      confirmPassword: z.string().min(1),
    });
    const { currentPassword, newPassword, confirmPassword } = schema.parse(req.body);
    if (newPassword !== confirmPassword) return res.status(400).json({ message: "Passwords do not match" });
    const user = await storage.getUser(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.password !== currentPassword) return res.status(400).json({ message: "Current password is incorrect" });
    await storage.updateUser(req.user.id, { password: newPassword });
    res.json({ message: "Password updated successfully" });
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message || "Validation error" });
    res.status(500).json({ message: "Failed to change password" });
  }
});

// GET /api/admin/sessions — list active sessions for the current admin
router.get("/api/admin/sessions", async (req: any, res) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const result = await pool.query(
      `SELECT sid, sess, expire FROM session WHERE (sess->'passport'->>'user')::int = $1 ORDER BY expire DESC`,
      [req.user.id]
    );
    const currentSid = req.sessionID;
    const sessions = result.rows.map((row: any) => {
      const sess = typeof row.sess === "string" ? JSON.parse(row.sess) : row.sess;
      return {
        sid: row.sid,
        expire: row.expire,
        isCurrent: row.sid === currentSid,
        ip: sess?.ip || null,
        userAgent: sess?.userAgent || null,
      };
    });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch sessions" });
  }
});

// DELETE /api/admin/sessions/:sid — revoke a session (cannot revoke own current session)
router.delete("/api/admin/sessions/:sid", async (req: any, res) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const { sid } = req.params;
    if (sid === req.sessionID) return res.status(400).json({ message: "Cannot revoke your current session" });
    const result = await pool.query(
      `DELETE FROM session WHERE sid = $1 AND (sess->'passport'->>'user')::int = $2`,
      [sid, req.user.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: "Session not found" });
    res.json({ message: "Session revoked" });
  } catch (err) {
    res.status(500).json({ message: "Failed to revoke session" });
  }
});

// GET /api/admin/system-status
router.get("/api/admin/system-status", async (req: any, res) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const uptimeSeconds = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSeconds / 3600);
    const mins = Math.floor((uptimeSeconds % 3600) / 60);
    const uptime = `${hours}h ${mins}m`;

    let dbStatus: "ok" | "error" = "ok";
    try { await pool.query("SELECT 1"); } catch { dbStatus = "error"; }

    const emailConfigured = !!(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN);

    let cronLastRun: string | null = null;
    let cronNextRun: string | null = null;
    try {
      const configs = await storage.getEmailCronConfigs();
      const active = configs.filter(c => c.isActive);
      if (active.length > 0) {
        const latest = active
          .filter(c => c.lastRunAt)
          .sort((a, b) => new Date(b.lastRunAt!).getTime() - new Date(a.lastRunAt!).getTime())[0];
        if (latest?.lastRunAt) cronLastRun = new Date(latest.lastRunAt).toISOString();
        const first = active[0];
        if (first?.runTime) {
          const [h, m] = first.runTime.split(":").map(Number);
          const next = new Date();
          next.setUTCHours(h, m, 0, 0);
          if (next <= new Date()) next.setUTCDate(next.getUTCDate() + 1);
          cronNextRun = next.toISOString();
        }
      }
    } catch {}

    res.json({ uptime, dbStatus, emailConfigured, cronLastRun, cronNextRun });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch system status" });
  }
});

// GET /api/admin/notification-preferences
router.get("/api/admin/notification-preferences", async (req: any, res) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const prefs = await storage.getNotificationPreferences(req.user.id);
    res.json(prefs);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch preferences" });
  }
});

// PUT /api/admin/notification-preferences
router.put("/api/admin/notification-preferences", async (req: any, res) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const schema = z.object({
      new_job_posted: z.boolean().optional(),
      new_user_registered: z.boolean().optional(),
      system_alerts: z.boolean().optional(),
      cron_failures: z.boolean().optional(),
      security_alerts: z.boolean().optional(),
    });
    const prefs = schema.parse(req.body);
    const existing = await storage.getNotificationPreferences(req.user.id);
    await storage.updateNotificationPreferences(req.user.id, { ...existing, ...prefs });
    res.json({ message: "Preferences saved" });
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ message: "Invalid preferences" });
    res.status(500).json({ message: "Failed to save preferences" });
  }
});

// POST /api/admin/security-scan — real checks
router.post("/api/admin/security-scan", async (req: any, res) => {
  if (!requireAdminSession(req, res)) return;
  const scannedAt = new Date().toISOString();
  console.log(`[security-scan] Scan triggered by admin ${req.user.id} at ${scannedAt}`);

  type ScanCheck = { label: string; status: "ok" | "warning" | "error"; detail: string };
  const checks: ScanCheck[] = [];

  try {
    // 1. Unverified admin email addresses
    const unverifiedResult = await pool.query(
      `SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin' AND email_verified = false`
    );
    const unverifiedCount = parseInt(unverifiedResult.rows[0].cnt, 10);
    checks.push(
      unverifiedCount === 0
        ? { label: "Admin email verification", status: "ok", detail: "All admin accounts have verified email addresses." }
        : { label: "Admin email verification", status: "warning", detail: `${unverifiedCount} admin account${unverifiedCount > 1 ? "s have" : " has"} an unverified email address.` }
    );

    // 2. Admin accounts that have never logged in
    const neverLoggedResult = await pool.query(
      `SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin' AND last_login_at IS NULL`
    );
    const neverLoggedCount = parseInt(neverLoggedResult.rows[0].cnt, 10);
    checks.push(
      neverLoggedCount === 0
        ? { label: "Admin login history", status: "ok", detail: "All admin accounts have logged in at least once." }
        : { label: "Admin login history", status: "warning", detail: `${neverLoggedCount} admin account${neverLoggedCount > 1 ? "s have" : " has"} never logged in.` }
    );

    // 3. Stale (expired) password reset tokens still stored in DB
    const staleTokenResult = await pool.query(
      `SELECT COUNT(*) AS cnt FROM users WHERE password_reset_token IS NOT NULL AND password_reset_token_expiry < NOW()`
    );
    const staleTokenCount = parseInt(staleTokenResult.rows[0].cnt, 10);
    checks.push(
      staleTokenCount === 0
        ? { label: "Password reset tokens", status: "ok", detail: "No expired password reset tokens found in the database." }
        : { label: "Password reset tokens", status: "warning", detail: `${staleTokenCount} expired password reset token${staleTokenCount > 1 ? "s are" : " is"} still stored in the database.` }
    );

    // 4. Email service configuration
    const emailConfigured = !!(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN);
    checks.push(
      emailConfigured
        ? { label: "Email service", status: "ok", detail: "Email service is configured (Mailgun)." }
        : { label: "Email service", status: "error", detail: "Email service is not configured. Password resets and notifications will not work." }
    );

    // 5. Pending password reset tokens (active, not yet expired)
    const activeTokenResult = await pool.query(
      `SELECT COUNT(*) AS cnt FROM users WHERE password_reset_token IS NOT NULL AND password_reset_token_expiry > NOW()`
    );
    const activeTokenCount = parseInt(activeTokenResult.rows[0].cnt, 10);
    checks.push(
      activeTokenCount === 0
        ? { label: "Active password resets", status: "ok", detail: "No active password reset requests pending." }
        : { label: "Active password resets", status: "ok", detail: `${activeTokenCount} password reset request${activeTokenCount > 1 ? "s are" : " is"} currently pending (in-progress resets).` }
    );

    const issueCount = checks.filter(c => c.status === "error").length;
    const warningCount = checks.filter(c => c.status === "warning").length;

    res.json({ scannedAt, checks, issueCount, warningCount });
  } catch (err: any) {
    console.error("[security-scan] Error:", err);
    res.status(500).json({ message: "Security scan failed: " + err.message });
  }
});

// GET /api/admin/admin-users — list all admin-role users
router.get("/api/admin/admin-users", async (req: any, res) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const admins = await storage.getAdminUsers();
    // isActive heuristic: lastLoginAt IS NOT NULL — a dedicated isActive column is a future task.
    const sanitized = admins.map(u => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      username: (u as any).username ?? null,
      role: u.role,
      emailVerified: u.emailVerified,
      lastLoginAt: (u as any).lastLoginAt ?? null,
      isActive: (u as any).lastLoginAt !== null && (u as any).lastLoginAt !== undefined,
      createdAt: u.createdAt,
      permissions: (u as any).permissions ?? null,
    }));
    res.json(sanitized);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch admin users" });
  }
});

// PATCH /api/admin/admin-users/:id/role — change an admin user's role
router.patch("/api/admin/admin-users/:id/role", async (req: any, res) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const targetId = parseInt(req.params.id);
    if (isNaN(targetId)) return res.status(400).json({ message: "Invalid user id" });
    if (targetId === req.user.id) return res.status(400).json({ message: "Cannot change your own role" });
    const schema = z.object({ role: z.enum(["admin", "employer", "job_seeker"]) });
    const { role } = schema.parse(req.body);
    const updated = await storage.updateAdminUserRole(targetId, role);
    res.json({ id: updated.id, role: updated.role });
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ message: "Invalid role" });
    res.status(500).json({ message: "Failed to update role" });
  }
});

// POST /api/admin/invite-admin — create a new admin user and send invite email
router.post("/api/admin/invite-admin", async (req: any, res) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const schema = z.object({
      email: z.string().email(),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      permissions: z.array(z.string()).nullable().optional(),
    });
    const { email, firstName, lastName, permissions } = schema.parse(req.body);
    const existing = await storage.getUserByEmail(email);
    if (existing) return res.status(409).json({ message: "A user with this email already exists" });
    const tempPassword = randomUUID().slice(0, 12);
    const user = await storage.inviteAdminUser(email, firstName, lastName, tempPassword, permissions ?? null);
    (async () => {
      try {
        const { sendTemplatedEmailByEvent } = await import("../email/sendTemplatedEmail.ts");
        const siteUrl = process.env.CANONICAL_HOST || "https://lanelogicjobs.com";
        await sendTemplatedEmailByEvent("admin_invite", email, {
          first_name: firstName,
          last_name: lastName,
          email,
          temp_password: tempPassword,
          login_url: `${siteUrl}/login`,
          site_name: "LaneLogic Jobs",
          site_url: siteUrl,
        });
      } catch {}
    })();
    res.status(201).json({ id: (user as any).id, email: (user as any).email, firstName: (user as any).firstName, lastName: (user as any).lastName, tempPassword });
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message || "Validation error" });
    res.status(500).json({ message: "Failed to invite admin user" });
  }
});

export default router;
