import { Router } from "express";
import passport from "passport";
import { z } from "zod";
import { randomUUID } from "crypto";
import { storage } from "../storage";
import { api } from "@shared/routes";

const router = Router();

// Auth Routes
router.post(api.auth.login.path, passport.authenticate('local'), (req: any, res) => {
  if (req.user?.id) {
    storage.updateLastLoginAt(req.user.id).catch(() => {});
  }
  res.json(req.user);
});

router.post(api.auth.register.path, async (req, res) => {
  try {
    const input = api.auth.register.input.parse(req.body);
    const existing = await storage.getUserByEmail((input as any).email);
    if (existing) {
      return res.status(400).json({ message: "Email already exists" });
    }
    const user = await storage.createUser(input);
    // Generate email verification token and fire emails (fire-and-forget)
    const verificationToken = randomUUID();
    await storage.updateUser((user as any).id, { emailVerificationToken: verificationToken });
    (async () => {
      try {
        const { sendTemplatedEmailByEvent } = await import("../email/sendTemplatedEmail.ts");
        const siteUrl = process.env.CANONICAL_HOST || "https://lanelogicjobs.com";
        await sendTemplatedEmailByEvent(
          (user as any).role === "employer" ? "user_registered_employer" : "user_registered_seeker",
          (user as any).email,
          {
            first_name: (user as any).firstName || (user as any).email,
            last_name: (user as any).lastName || "",
            email: (user as any).email,
            company_name: (user as any).companyName || "",
            site_name: "LaneLogic Jobs",
            site_url: siteUrl,
            dashboard_url: `${siteUrl}/dashboard`,
          }
        );
        await sendTemplatedEmailByEvent("email_verification", (user as any).email, {
          first_name: (user as any).firstName || (user as any).email,
          verification_link: `${siteUrl}/verify-email?token=${verificationToken}`,
          expires_in: "7 days",
          site_name: "LaneLogic Jobs",
          site_url: siteUrl,
        });
      } catch {}
    })();
    req.login(user, (err) => {
      if (err) throw err;
      res.status(201).json(user);
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post(api.auth.logout.path, (req, res) => {
  req.logout((err) => {
    res.json({ message: "Logged out" });
  });
});

// POST /api/auth/forgot-password
router.post("/api/auth/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });
  const user = await storage.getUserByEmail(email);
  // Always respond 200 to prevent email enumeration
  if (!user) return res.json({ message: "If that email exists you will receive a reset link shortly." });
  const token = randomUUID();
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await storage.updateUser((user as any).id, { passwordResetToken: token, passwordResetTokenExpiry: expiry });
  (async () => {
    try {
      const { sendTemplatedEmailByEvent } = await import("../email/sendTemplatedEmail.ts");
      const siteUrl = process.env.CANONICAL_HOST || "https://lanelogicjobs.com";
      await sendTemplatedEmailByEvent("password_reset", (user as any).email, {
        first_name: (user as any).firstName || (user as any).email,
        reset_link: `${siteUrl}/reset-password?token=${token}`,
        expires_in: "1 hour",
        site_name: "LaneLogic Jobs",
        site_url: siteUrl,
      });
    } catch (e: any) {
      console.error("Password reset email failed:", e?.message);
    }
  })();
  res.json({ message: "If that email exists you will receive a reset link shortly." });
});

// POST /api/auth/reset-password
router.post("/api/auth/reset-password", async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ message: "Token and password are required" });
  if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
  const user = await storage.getUserByPasswordResetToken(token);
  if (!user) return res.status(400).json({ message: "Invalid or expired reset link" });
  const expiry = (user as any).passwordResetTokenExpiry;
  if (!expiry || new Date(expiry) < new Date()) return res.status(400).json({ message: "Reset link has expired" });
  await storage.updateUser((user as any).id, {
    password,
    passwordResetToken: null as any,
    passwordResetTokenExpiry: null as any,
  });
  res.json({ message: "Password updated successfully" });
});

// GET /api/auth/verify-email?token=
router.get("/api/auth/verify-email", async (req, res) => {
  const { token } = req.query as { token?: string };
  if (!token) return res.status(400).json({ message: "Token is required" });
  const user = await storage.getUserByEmailVerificationToken(token);
  if (!user) return res.status(400).json({ message: "Invalid or already-used verification link" });
  await storage.updateUser((user as any).id, {
    emailVerified: true,
    emailVerificationToken: null as any,
  });
  res.json({ message: "Email verified successfully" });
});

// POST /api/auth/resend-verification — resend verification email for logged-in user
router.post("/api/auth/resend-verification", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  const user = req.user as any;
  if (user.emailVerified) return res.json({ message: "Email already verified" });
  const token = randomUUID();
  await storage.updateUser(user.id, { emailVerificationToken: token });
  (async () => {
    try {
      const { sendTemplatedEmailByEvent } = await import("../email/sendTemplatedEmail.ts");
      const siteUrl = process.env.CANONICAL_HOST || "https://lanelogicjobs.com";
      await sendTemplatedEmailByEvent("email_verification", user.email, {
        first_name: user.firstName || user.email,
        verification_link: `${siteUrl}/verify-email?token=${token}`,
        expires_in: "7 days",
        site_name: "LaneLogic Jobs",
        site_url: siteUrl,
      });
    } catch (e: any) {
      console.error("Resend verification email failed:", e?.message);
    }
  })();
  res.json({ message: "Verification email sent" });
});

router.get(api.auth.me.path, (req, res) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ message: "Not authenticated" });
  }
});

export default router;
