import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { insertPageSchema, jobs, insertEmailCronConfigSchema } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db, pool } from "./db";
import { z } from "zod";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import { createHash } from "crypto";
import { getPricingData, resolveUserEntitlements, checkEntitlement, consumeEntitlement, getQuotaStatus } from "./registry/entitlementResolver";
import { JOB_CATEGORIES, US_STATES as SEO_STATES } from "@shared/seoConfig";
import { validateKeywords } from "./taggingValidator";
import { validateCategoryPair, normalizeCategory, normalizeSubcategory, getCategories, getLiveTaxonomy, setLiveTaxonomy, type TaxonomyData } from "@shared/jobTaxonomy";
import { isR2Configured, uploadToR2 } from "./r2";
import { loadEmployerRegistry } from "./registry/employerRegistryLoader.ts";
import { syncEmployers } from "./registry/syncEmployers.ts";
import { requireAdminSession } from "./middleware/requireAdminSession.ts";

const LANELOGIC_OWNED_DOMAINS: string[] = (process.env.LANELOGIC_OWNED_DOMAINS || "lanelogicjobs.com,lanelogic.com")
  .split(",").map(d => d.trim().toLowerCase()).filter(Boolean);

function isLaneLogicDomain(urlStr: string): boolean {
  try {
    const host = new URL(urlStr).hostname.toLowerCase();
    return LANELOGIC_OWNED_DOMAINS.some(d => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

function parseCsvText(text: string): { headers: string[]; rows: string[][] } {
  const lines: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(field.trim());
        field = "";
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++;
        current.push(field.trim());
        if (current.some(c => c !== "")) lines.push(current);
        current = [];
        field = "";
      } else {
        field += ch;
      }
    }
  }
  current.push(field.trim());
  if (current.some(c => c !== "")) lines.push(current);

  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].map(h => h.replace(/^\uFEFF/, ""));
  return { headers, rows: lines.slice(1) };
}

interface RowError {
  rowNumber: number;
  field: string;
  errorCode: string;
  errorMessage: string;
}

function paragraphize(text: string): string {
  const newlineCount = (text.match(/\n/g) || []).length;
  if (newlineCount >= 2) return text;
  return text.replace(/([.?!])\s+/g, "$1\n\n");
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 999);
  return d;
}

function validateAndMapCsvRow(
  record: Record<string, string>,
  rowNumber: number,
  employerId: number,
): { job: any; errors: RowError[] } {
  const errors: RowError[] = [];
  const get = (key: string) => (record[key] || "").trim();

  const externalJobKey = get("externalJobKey");
  if (!externalJobKey) {
    errors.push({ rowNumber, field: "externalJobKey", errorCode: "MISSING_REQUIRED_FIELD", errorMessage: "externalJobKey is required" });
  }

  const title = get("title");
  if (!title) {
    errors.push({ rowNumber, field: "title", errorCode: "MISSING_REQUIRED_FIELD", errorMessage: "title is required" });
  }

  const description = get("description");
  if (!description) {
    errors.push({ rowNumber, field: "description", errorCode: "MISSING_REQUIRED_FIELD", errorMessage: "description is required" });
  }

  const requirements = get("requirements");
  if (!requirements) {
    errors.push({ rowNumber, field: "requirements", errorCode: "MISSING_REQUIRED_FIELD", errorMessage: "requirements is required" });
  }

  const rawCategory = get("category") || null;
  const rawSubcategory = get("subcategory") || null;
  let category: string | null = null;
  let subcategory: string | null = null;
  if (rawCategory) {
    const normalizedCat = normalizeCategory(rawCategory);
    if (!normalizedCat) {
      errors.push({ rowNumber, field: "category", errorCode: "INVALID_CATEGORY", errorMessage: `Category "${rawCategory}" is not a valid taxonomy category.` });
    } else {
      category = normalizedCat;
    }
  }
  if (rawSubcategory && !rawCategory) {
    errors.push({ rowNumber, field: "subcategory", errorCode: "INVALID_CATEGORY_PAIR", errorMessage: `Subcategory "${rawSubcategory}" provided without a category.` });
  } else if (rawSubcategory && rawCategory && !category) {
    errors.push({ rowNumber, field: "subcategory", errorCode: "INVALID_CATEGORY_PAIR", errorMessage: `Subcategory "${rawSubcategory}" provided with invalid category "${rawCategory}".` });
  } else if (rawSubcategory && category) {
    const normalizedSub = normalizeSubcategory(category, rawSubcategory);
    if (!normalizedSub) {
      errors.push({ rowNumber, field: "subcategory", errorCode: "INVALID_SUBCATEGORY", errorMessage: `Subcategory "${rawSubcategory}" is not valid for category "${category}".` });
    } else {
      subcategory = normalizedSub;
    }
  }
  const catPairResult = validateCategoryPair(category, subcategory);
  if (!catPairResult.valid) {
    errors.push({ rowNumber, field: "category", errorCode: "INVALID_CATEGORY_PAIR", errorMessage: catPairResult.error! });
  }

  let salary: string | null = null;
  const salaryMin = get("salaryMin");
  const salaryMax = get("salaryMax");
  const salaryUnit = get("salaryUnit") || "year";
  if (salaryMin || salaryMax) {
    if (salaryMin && isNaN(Number(salaryMin))) {
      errors.push({ rowNumber, field: "salaryMin", errorCode: "INVALID_NUMBER", errorMessage: `salaryMin "${salaryMin}" is not a valid number` });
    }
    if (salaryMax && isNaN(Number(salaryMax))) {
      errors.push({ rowNumber, field: "salaryMax", errorCode: "INVALID_NUMBER", errorMessage: `salaryMax "${salaryMax}" is not a valid number` });
    }
    if (salaryMin && salaryMax && !isNaN(Number(salaryMin)) && !isNaN(Number(salaryMax)) && Number(salaryMin) > Number(salaryMax)) {
      errors.push({ rowNumber, field: "salaryMin", errorCode: "MIN_GT_MAX", errorMessage: `salaryMin (${salaryMin}) is greater than salaryMax (${salaryMax})` });
    }
    if (!errors.some(e => e.field === "salaryMin" || e.field === "salaryMax")) {
      const parts = [];
      if (salaryMin) parts.push(salaryMin);
      if (salaryMax) parts.push(salaryMax);
      salary = parts.join("-") + `/${salaryUnit}`;
    }
  }

  const applyUrl = get("applyUrl") || null;
  let isExternalApply = false;
  if (applyUrl) {
    try {
      new URL(applyUrl);
      isExternalApply = !isLaneLogicDomain(applyUrl);
    } catch {
      errors.push({ rowNumber, field: "applyUrl", errorCode: "INVALID_URL", errorMessage: `applyUrl "${applyUrl}" is not a valid URL` });
    }
  }

  const employerUrlRaw = get("employerUrl") || null;
  let employerUrl: string | null = null;
  if (employerUrlRaw) {
    try {
      new URL(employerUrlRaw);
      employerUrl = employerUrlRaw;
    } catch {
      errors.push({ rowNumber, field: "employerUrl", errorCode: "INVALID_URL", errorMessage: `employerUrl "${employerUrlRaw}" is not a valid URL` });
    }
  }

  const expiresAtRaw = get("expiresAt") || null;
  let parsedExpiresAt: Date = daysFromNow(30);
  if (expiresAtRaw) {
    const d = new Date(expiresAtRaw);
    if (isNaN(d.getTime())) {
      errors.push({ rowNumber, field: "expiresAt", errorCode: "INVALID_DATE", errorMessage: `expiresAt "${expiresAtRaw}" is not a valid date` });
    } else if (d <= new Date()) {
      errors.push({ rowNumber, field: "expiresAt", errorCode: "PAST_DATE", errorMessage: `expiresAt "${expiresAtRaw}" must be a future date` });
    } else {
      parsedExpiresAt = d;
    }
  }

  const coreResponsibilities = get("coreResponsibilities") || null;
  const ALLOWED_EXPERIENCE_BANDS = new Set(["0-2", "2-5", "5-10", "10+"]);
  const experienceLevelYears = get("experienceLevelYears") || get("experienceLevel") || null;
  if (experienceLevelYears && !ALLOWED_EXPERIENCE_BANDS.has(experienceLevelYears)) {
    errors.push({ rowNumber, field: "experienceLevelYears", errorCode: "INVALID_EXPERIENCE_LEVEL", errorMessage: `experienceLevelYears "${experienceLevelYears}" is not valid. Allowed values: 0-2, 2-5, 5-10, 10+` });
  }
  const ALLOWED_WORK_LOCATION_TYPES = new Set(["remote", "hybrid", "on_site", "otr", "field_based"]);
  const rawWorkLocationType = get("workLocationType") || null;
  if (rawWorkLocationType && !ALLOWED_WORK_LOCATION_TYPES.has(rawWorkLocationType)) {
    errors.push({ rowNumber, field: "workLocationType", errorCode: "INVALID_WORK_LOCATION_TYPE", errorMessage: `workLocationType "${rawWorkLocationType}" is not valid. Allowed values: remote, hybrid, on_site, otr, field_based` });
  }

  const skillsRaw = get("skills");
  const keywordsRaw = get("keywords");
  const rawSkills = skillsRaw ? skillsRaw.split(",").map(s => s.trim()).filter(Boolean) : [];
  const rawKeywords = keywordsRaw ? keywordsRaw.split(",").map(s => s.trim()).filter(Boolean) : [];

  if (rawSkills.length > 0) {
    const skillsResult = validateKeywords(rawSkills);
    if (!skillsResult.valid) {
      for (const err of skillsResult.errors) {
        errors.push({ rowNumber, field: "skills", errorCode: err.errorCode, errorMessage: err.errorMessage });
      }
    }
  }

  if (rawKeywords.length > 0) {
    const keywordsResult = validateKeywords(rawKeywords);
    if (!keywordsResult.valid) {
      for (const err of keywordsResult.errors) {
        errors.push({ rowNumber, field: "keywords", errorCode: err.errorCode, errorMessage: err.errorMessage });
      }
    }
  }

  const jobMetadata: Record<string, any> = {};
  if (coreResponsibilities) jobMetadata.coreResponsibilities = coreResponsibilities;
  if (experienceLevelYears && ALLOWED_EXPERIENCE_BANDS.has(experienceLevelYears)) jobMetadata.experienceLevelYears = experienceLevelYears;
  if (rawSkills.length > 0) jobMetadata.rawSkills = rawSkills;
  if (rawKeywords.length > 0) jobMetadata.rawKeywords = rawKeywords;

  const job = {
    employerId,
    externalJobKey: externalJobKey || null,
    title: title || "",
    companyName: get("companyName") || null,
    jobType: get("jobType") || null,
    category,
    subcategory,
    industry: get("industry") || null,
    description: paragraphize(description || ""),
    requirements: requirements || "",
    benefits: get("benefits") || null,
    locationCity: get("locationCity") || null,
    locationState: get("locationState") || null,
    locationCountry: get("locationCountry") || null,
    workLocationType: rawWorkLocationType && ALLOWED_WORK_LOCATION_TYPES.has(rawWorkLocationType) ? rawWorkLocationType : null,
    salary,
    applyUrl,
    employerUrl,
    isExternalApply,
    isPublished: true,
    publishedAt: new Date(),
    expiresAt: parsedExpiresAt,
    jobMetadata: Object.keys(jobMetadata).length > 0 ? jobMetadata : null,
  };

  return { job, errors };
}

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

const csvDiskStorage = multer.diskStorage({
  destination: path.join(process.cwd(), "uploads"),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});

const MAX_CSV_FILE_BYTES = parseInt(process.env.MAX_CSV_FILE_BYTES || String(10 * 1024 * 1024), 10);
const MAX_CSV_ROWS = parseInt(process.env.MAX_CSV_ROWS || "5000", 10);

const csvUpload = multer({
  storage: csvDiskStorage,
  limits: { fileSize: MAX_CSV_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (/\.csv$/i.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const r2Ready = isR2Configured();
  if (!r2Ready && process.env.NODE_ENV === "production") {
    console.warn("[R2] WARNING: R2 is not configured in production. Uploads will use ephemeral local disk and may be lost on restart.");
  }

  app.set('trust proxy', 1);

  const sessionConfig: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'supersecret',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    },
  };

  if (process.env.DATABASE_URL) {
    try {
      const PgStore = connectPgSimple(session);
      sessionConfig.store = new PgStore({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
        tableName: 'session',
        pruneSessionInterval: 60 * 15,
        errorLog: (err: Error) => {
          console.error('Session store error:', err.message);
        },
      });
      console.log('Using PostgreSQL session store');
    } catch (err) {
      console.error('Failed to create PG session store, using memory store:', err);
    }
  }

  app.use(session(sessionConfig));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
      const user = await storage.getUserByEmail(email);
      if (!user || user.password !== password) {
        return done(null, false, { message: 'Incorrect email or password.' });
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Auth Routes
  app.post(api.auth.login.path, passport.authenticate('local'), (req: any, res) => {
    if (req.user?.id) {
      storage.updateLastLoginAt(req.user.id).catch(() => {});
    }
    res.json(req.user);
  });

  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      const existing = await storage.getUserByEmail(input.email);
      if (existing) {
        return res.status(400).json({ message: "Email already exists" });
      }
      const user = await storage.createUser(input);
      // Generate email verification token and fire emails (fire-and-forget)
      const verificationToken = randomUUID();
      await storage.updateUser((user as any).id, { emailVerificationToken: verificationToken });
      (async () => {
        try {
          const { sendTemplatedEmailByEvent } = await import("./email/sendTemplatedEmail.ts");
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

  app.post(api.auth.logout.path, (req, res) => {
    req.logout((err) => {
      res.json({ message: "Logged out" });
    });
  });

  // POST /api/auth/forgot-password
  app.post("/api/auth/forgot-password", async (req, res) => {
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
        const { sendTemplatedEmailByEvent } = await import("./email/sendTemplatedEmail.ts");
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
  app.post("/api/auth/reset-password", async (req, res) => {
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
  app.get("/api/auth/verify-email", async (req, res) => {
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
  app.post("/api/auth/resend-verification", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    if (user.emailVerified) return res.json({ message: "Email already verified" });
    const token = randomUUID();
    await storage.updateUser(user.id, { emailVerificationToken: token });
    (async () => {
      try {
        const { sendTemplatedEmailByEvent } = await import("./email/sendTemplatedEmail.ts");
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

  app.get(api.auth.me.path, (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  const { registerAdminProductRoutes } = await import("./adminProductRoutes");
  registerAdminProductRoutes(app);

  // One-time: normalize any admin_products rows that have non-standard audience values
  // (e.g. "Job Seeker" Title Case → "job_seeker") caused by old form submissions
  storage.getAdminProducts().then(async (products) => {
    const fix = (aud: string) => {
      const l = aud.toLowerCase();
      if (aud === "employer" || aud === "job_seeker") return null; // already correct
      if (l.includes("employer")) return "employer";
      if (l.includes("job") || l.includes("seeker")) return "job_seeker";
      return null;
    };
    for (const p of products) {
      const normalized = fix(p.audience);
      if (normalized) {
        await storage.updateAdminProduct(p.id, { audience: normalized }).catch(() => {});
        console.log(`[startup] Normalized audience for product "${p.name}" (id=${p.id}): "${p.audience}" → "${normalized}"`);
      }
    }
  }).catch(() => {});

  const { employerVerificationRouter } = await import("./routes/employerVerification");
  app.use(employerVerificationRouter);

  const { seekerVerificationRouter } = await import("./routes/seekerVerification");
  app.use(seekerVerificationRouter);

  const { default: menuRouter } = await import("./routes/menuRoutes");
  app.use("/api", menuRouter);

  const { registerAdminImportRoutes } = await import("./adminImportRoutes");
  registerAdminImportRoutes(app);

  app.get("/api/admin/registry/employers", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const environment = process.env.NODE_ENV === "production" ? "prod" : "staging";
      res.json(await loadEmployerRegistry(environment));
    } catch (err) {
      res.status(500).json({ error: "internal_error", message: String(err) });
    }
  });

  app.post("/api/admin/registry-sync/employers", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const environment = process.env.NODE_ENV === "production" ? "prod" : "staging";
      res.json(await syncEmployers({ environment }));
    } catch (err) {
      res.status(500).json({ error: "internal_error", message: String(err) });
    }
  });

  // Users
  app.get(api.users.list.path, async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const users = await storage.getUsers();
    res.json(users);
  });

  // Admin: create a user directly (invite)
  app.post("/api/admin/users", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const { email, password, role, firstName, lastName, companyName, membershipTier } = req.body;
      if (!email || !password || !role) {
        return res.status(400).json({ message: "email, password and role are required" });
      }
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "Email already in use" });
      }
      const user = await storage.createUser({
        email,
        password,
        role,
        firstName: firstName || null,
        lastName: lastName || null,
        companyName: companyName || null,
        membershipTier: membershipTier || "free",
      });
      res.status(201).json(user);
    } catch (err) {
      res.status(500).json({ message: "Could not create user" });
    }
  });

  app.put(api.users.update.path, async (req, res) => {
    if (!req.isAuthenticated() || !req.user) return res.status(401).json({ message: "Unauthorized" });
    const caller = req.user as any;
    const targetId = Number(req.params.id);
    if (caller.role !== "admin" && caller.id !== targetId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const input = api.users.update.input.parse(req.body);
      const user = await storage.updateUser(targetId, input);
      res.json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/employers", async (_req, res) => {
    try {
      const allUsers = await storage.getUsers();
      const allJobs = await storage.getJobs();

      const employerMap = new Map<string, {
        id: number | null;
        companyName: string;
        companyLogo: string | null;
        claimed: boolean;
        verificationStatus: string | null;
        jobCount: number;
        industries: Set<string>;
        locations: Set<string>;
        createdAt: Date | null;
      }>();

      const registeredEmployers = allUsers.filter((u) => u.role === "employer");
      for (const u of registeredEmployers) {
        const name = (u.companyName || "").trim();
        if (!name) continue;
        const key = name.toLowerCase();
        employerMap.set(key, {
          id: u.id,
          companyName: name,
          companyLogo: u.companyLogo,
          claimed: true,
          verificationStatus: u.verificationStatus || null,
          jobCount: 0,
          industries: new Set(),
          locations: new Set(),
          createdAt: u.createdAt,
        });
      }

      for (const job of allJobs) {
        const name = (job.companyName || "").trim();
        if (!name) continue;
        const key = name.toLowerCase();

        if (!employerMap.has(key)) {
          employerMap.set(key, {
            id: null,
            companyName: name,
            companyLogo: null,
            claimed: false,
            verificationStatus: null,
            jobCount: 0,
            industries: new Set(),
            locations: new Set(),
            createdAt: job.createdAt,
          });
        }

        const entry = employerMap.get(key)!;
        entry.jobCount++;
        if (job.industry) entry.industries.add(job.industry);
        const loc = [job.locationCity, job.locationState].filter(Boolean).join(", ");
        if (loc) entry.locations.add(loc);
      }

      const employers = [...employerMap.values()]
        .map((e) => ({
          id: e.id,
          companyName: e.companyName,
          companyLogo: e.companyLogo,
          claimed: e.claimed,
          verificationStatus: e.verificationStatus,
          jobCount: e.jobCount,
          industries: [...e.industries],
          locations: [...e.locations],
          createdAt: e.createdAt,
        }))
        .sort((a, b) => b.jobCount - a.jobCount);

      res.json(employers);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/employers/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid employer id" });
      const employer = await storage.getUser(id);
      if (!employer || employer.role !== "employer") return res.status(404).json({ message: "Employer not found" });
      const allJobs = await storage.getJobs();
      const jobs = allJobs.filter(j => j.employerId === id && j.isPublished);
      const industries = [...new Set(jobs.map(j => j.industry).filter(Boolean))];
      const locations = [...new Set(jobs.map(j => [j.locationCity, j.locationState].filter(Boolean).join(", ")).filter(Boolean))];
      res.json({
        id: employer.id,
        companyName: employer.companyName,
        companyLogo: employer.companyLogo,
        companyAddress: employer.showProfile ? employer.companyAddress : null,
        contactName: employer.showProfile ? employer.contactName : null,
        contactEmail: employer.showProfile ? employer.contactEmail : null,
        contactPhone: employer.showProfile ? employer.contactPhone : null,
        aboutCompany: employer.aboutCompany,
        claimed: !!employer.companyName,
        verificationStatus: employer.verificationStatus || null,
        industries,
        locations,
        jobs: jobs.map(j => ({
          id: j.id,
          title: j.title,
          jobType: j.jobType,
          locationCity: j.locationCity,
          locationState: j.locationState,
          workLocationType: j.workLocationType,
          salary: j.salary,
          category: j.category,
          expiresAt: j.expiresAt,
        })),
      });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Jobs
  app.get(api.jobs.list.path, async (req, res) => {
    const isAdmin = req.isAuthenticated() && (req.user as any).role === "admin";
    const allJobs = await storage.getJobs();
    const now = new Date();
    const visibleJobs = isAdmin ? allJobs : allJobs.filter(j => {
      if (!j.isPublished) return false;
      if (j.expiresAt) {
        const expires = typeof j.expiresAt === "string" ? new Date(j.expiresAt) : j.expiresAt;
        if (expires < now) return false;
      }
      return true;
    });
    const allUsers = await storage.getUsers();
    const employerMap = new Map(allUsers.filter(u => u.role === "employer").map(u => [u.id, u]));
    const enriched = visibleJobs.map(job => ({
      ...job,
      employerLogo: employerMap.get(job.employerId)?.companyLogo || null,
      employerHasProfile: employerMap.has(job.employerId),
      employerVerificationStatus: employerMap.get(job.employerId)?.verificationStatus || null,
    }));
    res.json(enriched);
  });

  app.get(api.jobs.get.path, async (req, res) => {
    const job = await storage.getJob(Number(req.params.id));
    if (!job) return res.status(404).json({ message: "Not found" });
    const isAdmin = req.isAuthenticated() && (req.user as any).role === "admin";
    if (!isAdmin && !job.isPublished) return res.status(404).json({ message: "Not found" });
    if (!isAdmin && job.expiresAt) {
      const expires = typeof job.expiresAt === "string" ? new Date(job.expiresAt) : job.expiresAt;
      if (expires < new Date()) return res.status(404).json({ message: "Not found" });
    }
    const employer = await storage.getUser(job.employerId);
    res.json({
      ...job,
      employerLogo: employer?.companyLogo || null,
      employerVerificationStatus: employer?.verificationStatus || null,
      employerIsRegistered: !!employer,
    });
  });

  app.post(api.jobs.create.path, async (req, res) => {
    try {
      if (req.isAuthenticated()) {
        const user = req.user as any;
        if (user.role === "employer") {
          const ent = await checkEntitlement(user, "job_posts_per_month");
          if (!ent.allowed) {
            return res.status(403).json({ message: "You have reached your job posting limit for this month. Please upgrade your plan." });
          }
        }
      }
      const body = { ...req.body };
      if (body.expiresAt && typeof body.expiresAt === "string") body.expiresAt = new Date(body.expiresAt);
      if (body.expiresAt === null || body.expiresAt === "") body.expiresAt = null;
      if (body.category === "") body.category = null;
      if (body.subcategory === "") body.subcategory = null;
      if (!body.workLocationType || body.workLocationType === "none") body.workLocationType = null;

      // Expiration rules
      const postingUser = req.isAuthenticated() ? (req.user as any) : null;
      if (postingUser?.role === "admin") {
        body.expiresAt = daysFromNow(30);
      } else if (postingUser?.role === "employer") {
        if (!body.expiresAt) {
          body.expiresAt = daysFromNow(30);
        } else {
          if (new Date(body.expiresAt) > daysFromNow(31)) {
            return res.status(400).json({ message: "Expiration date cannot be more than 31 days from today." });
          }
        }
      }

      const catCheck = validateCategoryPair(body.category ?? null, body.subcategory ?? null);
      if (!catCheck.valid) return res.status(400).json({ message: catCheck.error });
      const input = api.jobs.create.input.parse(body);
      const job = await storage.createJob(input);
      res.status(201).json(job);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put(api.jobs.update.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const jobId = Number(req.params.id);
    const existingJob = await storage.getJob(jobId);
    if (!existingJob) return res.status(404).json({ message: "Job not found" });
    if (user.role !== "admin" && existingJob.employerId !== user.id) return res.status(403).json({ message: "Forbidden" });
    try {
      const body = { ...req.body };
      if (body.expiresAt && typeof body.expiresAt === "string") body.expiresAt = new Date(body.expiresAt);
      if (body.expiresAt === null || body.expiresAt === "") body.expiresAt = null;
      if (body.publishedAt && typeof body.publishedAt === "string") body.publishedAt = new Date(body.publishedAt);
      if (body.publishedAt === null || body.publishedAt === "") body.publishedAt = null;
      if (body.category === "") body.category = null;
      if (body.subcategory === "") body.subcategory = null;
      if (body.workLocationType === "" || body.workLocationType === "none") body.workLocationType = null;

      // Expiration rules on update
      if (user.role === "admin") {
        body.expiresAt = daysFromNow(30);
      } else {
        // employer: if no new date provided, preserve existing expiration; otherwise validate cap
        if (!body.expiresAt) {
          delete body.expiresAt;
        } else {
          if (new Date(body.expiresAt) > daysFromNow(31)) {
            return res.status(400).json({ message: "Expiration date cannot be more than 31 days from today." });
          }
        }
      }

      const mergedCat = body.category !== undefined ? body.category : existingJob.category;
      const mergedSub = body.subcategory !== undefined ? body.subcategory : existingJob.subcategory;
      const catCheck = validateCategoryPair(mergedCat ?? null, mergedSub ?? null);
      if (!catCheck.valid) return res.status(400).json({ message: catCheck.error });
      const input = api.jobs.update.input.parse(body);
      const job = await storage.updateJob(jobId, input);
      res.json(job);

      // Fire job_posted email when isPublished flips false→true
      if (!existingJob.isPublished && input.isPublished) {
        (async () => {
          try {
            const { sendTemplatedEmailByEvent } = await import("./email/sendTemplatedEmail.ts");
            const employer = await storage.getUser(job.employerId);
            if (!employer) return;
            const siteUrl = process.env.CANONICAL_HOST || "https://lanelogicjobs.com";
            await sendTemplatedEmailByEvent("job_posted", (employer as any).email, {
              first_name: (employer as any).firstName || (employer as any).companyName || (employer as any).email,
              company_name: (employer as any).companyName || "",
              job_title: job.title,
              job_url: `${siteUrl}/jobs/${job.id}`,
              dashboard_url: `${siteUrl}/dashboard`,
              site_name: "LaneLogic Jobs",
              site_url: siteUrl,
            });
          } catch (e: any) {
            console.error("job_posted email failed:", e?.message);
          }
        })();

        // Fire job alert emails for matching subscriptions (fire-and-forget)
        (async () => {
          try {
            const { sendTemplatedEmailByEvent } = await import("./email/sendTemplatedEmail.ts");
            const alerts = await storage.getAllJobAlerts();
            const siteUrl = process.env.CANONICAL_HOST || "https://lanelogicjobs.com";
            const jobTitle = (job.title || "").toLowerCase();
            const jobDesc = (job.description || "").toLowerCase();

            for (const alert of alerts) {
              // Match keyword
              if (alert.keyword) {
                const kw = alert.keyword.toLowerCase();
                if (!jobTitle.includes(kw) && !jobDesc.includes(kw)) continue;
              }
              // Match category
              if (alert.category && alert.category !== job.category) continue;
              // Match subcategory
              if (alert.subcategory && alert.subcategory !== job.subcategory) continue;
              // Match locationState
              if (alert.locationState && alert.locationState !== job.locationState) continue;
              // Match jobType
              if (alert.jobType && alert.jobType !== job.jobType) continue;
              // Match workLocationType
              if (alert.workLocationType && alert.workLocationType !== job.workLocationType) continue;

              // Passed all filters — notify this subscriber
              const subscriber = await storage.getUser(alert.userId);
              if (!subscriber) continue;
              await sendTemplatedEmailByEvent("job_alert", (subscriber as any).email, {
                first_name: (subscriber as any).firstName || (subscriber as any).email,
                job_title: job.title,
                company_name: job.companyName || "",
                job_url: `${siteUrl}/jobs/${job.id}`,
                site_name: "LaneLogic Jobs",
                site_url: siteUrl,
                unsubscribe_url: `${siteUrl}/dashboard`,
              });
              await storage.updateJobAlertNotifiedAt(alert.id, new Date());
            }
          } catch (e: any) {
            console.error("job_alert emails failed:", e?.message);
          }
        })();
      }
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete(api.jobs.delete.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const jobId = Number(req.params.id);
    const existingJob = await storage.getJob(jobId);
    if (!existingJob) return res.status(404).json({ message: "Job not found" });
    if (user.role !== "admin" && existingJob.employerId !== user.id) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteJob(jobId);
    res.status(204).end();
  });

  app.put("/api/jobs-bulk-update", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const { ids, updates } = req.body as { ids: number[]; updates: Record<string, any> };
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "No job IDs provided" });
      const allowed = ["jobType", "category", "subcategory", "industry"];
      const filtered: Record<string, any> = {};
      for (const key of allowed) {
        if (key in updates) filtered[key] = updates[key];
      }
      if (Object.keys(filtered).length === 0) return res.status(400).json({ message: "No valid fields to update" });
      if ("category" in filtered && filtered.category === "") filtered.category = null;
      if ("subcategory" in filtered && filtered.subcategory === "") filtered.subcategory = null;
      if ("category" in filtered || "subcategory" in filtered) {
        const hasCatUpdate = "category" in filtered;
        const hasSubUpdate = "subcategory" in filtered;
        if (hasCatUpdate && hasSubUpdate) {
          const catCheck = validateCategoryPair(filtered.category ?? null, filtered.subcategory ?? null);
          if (!catCheck.valid) return res.status(400).json({ message: catCheck.error });
        } else {
          for (const id of ids) {
            const existingJob = await storage.getJob(id);
            if (!existingJob) continue;
            const mergedCat = hasCatUpdate ? (filtered.category ?? null) : (existingJob.category ?? null);
            const mergedSub = hasSubUpdate ? (filtered.subcategory ?? null) : (existingJob.subcategory ?? null);
            const catCheck = validateCategoryPair(mergedCat, mergedSub);
            if (!catCheck.valid) return res.status(400).json({ message: `Job #${id}: ${catCheck.error}` });
          }
        }
      }
      const results = await Promise.all(ids.map(id => storage.updateJob(id, filtered)));
      res.json({ updated: results.length });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Applications — admin-only list (employer/seeker views use /api/employer/applicants and /api/seeker/applications)
  app.get(api.applications.list.path, async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const apps = await storage.getApplications();
    res.json(apps);
  });

  // Enriched applicants for the logged-in employer
  app.get("/api/employer/applicants", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    if (user.role !== "employer" && user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const apps = await storage.getEmployerApplicationsEnriched(user.id);
    // Strip seeker-private notes before returning to employers
    const safeApps = apps.map(({ seekerNotes: _s, ...rest }: any) => rest);
    res.json(safeApps);
  });

  // GET /api/seeker/applications — returns the logged-in seeker's own applications (including viewedAt)
  app.get("/api/seeker/applications", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    if (user.role !== "job_seeker" && user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const apps = await storage.getApplicationsBySeeker(user.id);
    res.json(apps);
  });

  // GET /api/employer/analytics — summary stats for employer dashboard
  app.get("/api/employer/analytics", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    if (user.role !== "employer" && user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const [apps, allJobs] = await Promise.all([
      storage.getEmployerApplicationsEnriched(user.id),
      storage.getJobs({ status: "all" as any }),
    ]);
    const myJobs = allJobs.filter((j: any) => j.employerId === user.id);
    const activeJobs = myJobs.filter((j: any) => j.status === "active").length;
    const totalApps = apps.length;
    const newApps = apps.filter((a: any) => !a.viewedAt).length;
    const shortlisted = apps.filter((a: any) => ["shortlisted", "reviewed"].includes(a.status)).length;
    const hired = apps.filter((a: any) => ["hired", "accepted"].includes(a.status)).length;
    // Applications in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentApps = apps.filter((a: any) => a.createdAt && new Date(a.createdAt) >= thirtyDaysAgo).length;
    res.json({ activeJobs, totalJobs: myJobs.length, totalApps, newApps, shortlisted, hired, recentApps });
  });

  app.post(api.applications.create.path, async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "You must be logged in to apply for jobs." });
      }
      const user = req.user as any;
      const input = api.applications.create.input.parse(req.body);

      if (user.role === "job_seeker") {
        input.jobSeekerId = user.id;

        const txResult = await storage.runTransaction(async (tx) => {
          const result = await consumeEntitlement(user, "applications_per_month", { sourceEvent: "application", tx });
          if (!result.allowed) {
            return { denied: true, result };
          }
          const appData = await storage.createApplication(input, tx);
          return { denied: false, appData, result };
        });

        if (txResult.denied) {
          return res.status(403).json({
            message: "You have reached your application limit for this month. Purchase a top-up credit pack or wait until your quota resets.",
            error: txResult.result.error,
            resetDate: txResult.result.resetDate,
          });
        }

        let verificationWarning: string | undefined;
        try {
          const job = await storage.getJob(input.jobId);
          if (job) {
            const jobTags = (job.tags || []).filter((t): t is string => !!t);
            let employerCategory: string | null = null;
            const employer = await storage.getUser(job.employerId);
            if (employer) employerCategory = employer.employerCategory || null;
            const jobState = job.locationState || null;
            const { computeRequirementsForSeeker } = await import("./routes/seekerVerification");
            const computed = await computeRequirementsForSeeker(user.seekerTrack, jobTags, employerCategory, jobState);
            if (computed.length > 0) {
              const activeReq = await storage.getOrCreateSeekerVerificationRequest(user.id);
              await storage.appendRequirementsSnapshot(activeReq.id, computed.map(r => r.key));
            }
          }
        } catch (appendErr) {
          console.error("[applications] seeker verification append error:", appendErr);
          verificationWarning = "Application submitted, but credential requirements could not be updated. Visit your credentials page to review.";
        }

        const responseData = verificationWarning
          ? { ...txResult.appData, verificationWarning }
          : txResult.appData;
        // Fire-and-forget application received email
        (async () => {
          try {
            const { sendTemplatedEmailByEvent } = await import("./email/sendTemplatedEmail.ts");
            const seekerUser = await storage.getUser(user.id);
            const appJob = await storage.getJob((txResult.appData as any).jobId);
            if (seekerUser && appJob) {
              const siteUrl = process.env.CANONICAL_HOST || "https://lanelogicjobs.com";
              const employer = await storage.getUser(appJob.employerId);
              const companyName = employer
                ? ((employer as any).companyName || [(employer as any).firstName, (employer as any).lastName].filter(Boolean).join(" "))
                : "the company";
              await sendTemplatedEmailByEvent("application_received", (seekerUser as any).email, {
                first_name: (seekerUser as any).firstName || (seekerUser as any).email,
                job_title: appJob.title,
                company_name: companyName,
                application_id: String((txResult.appData as any).id),
                site_url: siteUrl,
                dashboard_url: `${siteUrl}/dashboard`,
              });
              if (employer && (employer as any).email) {
                const applicantName = [(seekerUser as any).firstName, (seekerUser as any).lastName].filter(Boolean).join(" ") || (seekerUser as any).email;
                await sendTemplatedEmailByEvent("employer_new_applicant", (employer as any).email, {
                  first_name: (employer as any).firstName || (employer as any).email,
                  company_name: companyName,
                  applicant_name: applicantName,
                  job_title: appJob.title,
                  site_name: "LaneLogic Jobs",
                  site_url: siteUrl,
                  dashboard_url: `${siteUrl}/dashboard`,
                });
              }
            }
          } catch {}
        })();
        return res.status(201).json(responseData);
      }

      const appData = await storage.createApplication(input);
      res.status(201).json(appData);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put(api.applications.update.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const appId = Number(req.params.id);

    if (user.role === "job_seeker") {
      // Seekers may only update seekerNotes on their own applications
      const existing = await db.query.applications.findFirst({ where: (a, { eq }) => eq(a.id, appId) });
      if (!existing) return res.status(404).json({ message: "Not found" });
      if (existing.jobSeekerId !== user.id) return res.status(403).json({ message: "Forbidden" });
      const { seekerNotes } = req.body;
      const appData = await storage.updateApplication(appId, { seekerNotes: seekerNotes ?? existing.seekerNotes });
      const { employerNotes: _e, ...seekerView } = appData as any;
      return res.json(seekerView);
    }

    if (user.role === "employer") {
      const existing = await db.query.applications.findFirst({ where: (a, { eq }) => eq(a.id, appId) });
      if (!existing) return res.status(404).json({ message: "Not found" });
      const job = await storage.getJob(existing.jobId);
      if (!job || job.employerId !== user.id) return res.status(403).json({ message: "Forbidden" });
    } else if (user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const input = api.applications.update.input.parse(req.body);
      const appData = await storage.updateApplication(appId, input);
      const { seekerNotes: _s, ...employerView } = appData as any;
      res.json(employerView);
      // Fire-and-forget status change email
      if (input.status) {
        (async () => {
          try {
            const { sendTemplatedEmailByEvent } = await import("./email/sendTemplatedEmail.ts");
            const updatedApp = await db.query.applications.findFirst({ where: (a, { eq }) => eq(a.id, appId) });
            if (!updatedApp) return;
            const [seekerUser, appJob] = await Promise.all([
              storage.getUser(updatedApp.seekerId),
              storage.getJob(updatedApp.jobId),
            ]);
            if (!seekerUser || !appJob) return;
            const employer = await storage.getUser(appJob.employerId);
            const siteUrl = process.env.CANONICAL_HOST || "https://lanelogicjobs.com";
            await sendTemplatedEmailByEvent("application_status_changed", (seekerUser as any).email, {
              first_name: (seekerUser as any).firstName || (seekerUser as any).email,
              job_title: appJob.title,
              company_name: employer ? ((employer as any).companyName || [(employer as any).firstName, (employer as any).lastName].filter(Boolean).join(" ")) : "the company",
              new_status: input.status,
              application_id: String(appId),
              site_url: siteUrl,
              dashboard_url: `${siteUrl}/dashboard`,
            });
          } catch {}
        })();
      }
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /api/applications/:id/viewed — employer marks an application as viewed
  app.post("/api/applications/:id/viewed", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    if (user.role !== "employer" && user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const appId = Number(req.params.id);
    const existing = await db.query.applications.findFirst({ where: (a, { eq }) => eq(a.id, appId) });
    if (!existing) return res.status(404).json({ message: "Application not found" });
    // Verify employer owns the job (unless admin)
    if (user.role === "employer") {
      const appJob = await storage.getJob(existing.jobId);
      if (!appJob || appJob.employerId !== user.id) return res.status(403).json({ message: "Forbidden" });
    }
    await storage.markApplicationViewed(appId);
    res.json({ ok: true });
  });

  // DELETE /api/applications/:id — seeker withdraws their application
  app.delete("/api/applications/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const appId = Number(req.params.id);
    const existing = await db.query.applications.findFirst({ where: (a, { eq }) => eq(a.id, appId) });
    if (!existing) return res.status(404).json({ message: "Application not found" });
    // Only the seeker who owns it (or admin) may withdraw
    if (user.role !== "admin" && existing.jobSeekerId !== user.id) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteApplication(appId);
    res.status(204).end();
    // Notify employer (fire-and-forget)
    (async () => {
      try {
        const { sendTemplatedEmailByEvent } = await import("./email/sendTemplatedEmail.ts");
        const [appJob, seeker] = await Promise.all([
          storage.getJob(existing.jobId),
          storage.getUser(existing.jobSeekerId),
        ]);
        if (!appJob || !seeker) return;
        const employer = await storage.getUser(appJob.employerId);
        if (!employer) return;
        const siteUrl = process.env.CANONICAL_HOST || "https://lanelogicjobs.com";
        const seekerName = [(seeker as any).firstName, (seeker as any).lastName].filter(Boolean).join(" ") || (seeker as any).email;
        await sendTemplatedEmailByEvent("application_withdrawn", (employer as any).email, {
          first_name: (employer as any).firstName || (employer as any).companyName || (employer as any).email,
          seeker_name: seekerName,
          job_title: appJob.title,
          company_name: (employer as any).companyName || "",
          dashboard_url: `${siteUrl}/dashboard`,
          site_url: siteUrl,
        });
      } catch (e: any) {
        console.error("application_withdrawn email failed:", e?.message);
      }
    })();
  });

  // ── Job Alert Subscriptions ──────────────────────────────────────────────
  // GET /api/alerts — list seeker's own alerts
  app.get("/api/alerts", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const alerts = await storage.getJobAlerts(user.id);
    res.json(alerts);
  });

  // POST /api/alerts — create a new alert
  app.post("/api/alerts", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const { name, keyword, category, subcategory, locationState, jobType, workLocationType } = req.body;
    // Require at least one filter
    if (!keyword && !category && !locationState && !jobType && !workLocationType) {
      return res.status(400).json({ message: "At least one filter (keyword, category, location, job type) is required" });
    }
    const existing = await storage.getJobAlerts(user.id);
    if (existing.length >= 5) {
      return res.status(400).json({ message: "You can have at most 5 job alerts" });
    }
    const alert = await storage.createJobAlert({
      userId: user.id,
      name: name || null,
      keyword: keyword || null,
      category: category || null,
      subcategory: subcategory || null,
      locationState: locationState || null,
      jobType: jobType || null,
      workLocationType: workLocationType || null,
      isActive: true,
    });
    res.status(201).json(alert);
  });

  // PATCH /api/alerts/:id — update alert (pause/resume, rename)
  app.patch("/api/alerts/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const alertId = Number(req.params.id);
    if (isNaN(alertId)) return res.status(400).json({ message: "Invalid alert id" });
    const { isActive, name } = req.body;
    const updates: { isActive?: boolean; name?: string } = {};
    if (typeof isActive === "boolean") updates.isActive = isActive;
    if (typeof name === "string") updates.name = name;
    const alert = await storage.updateJobAlert(alertId, user.id, updates);
    if (!alert) return res.status(404).json({ message: "Alert not found" });
    res.json(alert);
  });

  // DELETE /api/alerts/:id — delete an alert
  app.delete("/api/alerts/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    const alertId = Number(req.params.id);
    if (isNaN(alertId)) return res.status(400).json({ message: "Invalid alert id" });
    await storage.deleteJobAlert(alertId, user.id);
    res.status(204).end();
  });

  // Saved Jobs
  // GET /api/saved-jobs — list seeker's saved jobs (returns SavedJob[] with jobId)
  app.get("/api/saved-jobs", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    if (user.role !== "job_seeker") return res.status(403).json({ message: "Forbidden" });
    const saved = await storage.getSavedJobsBySeeker(user.id);
    res.json(saved);
  });

  // POST /api/saved-jobs — save a job
  app.post("/api/saved-jobs", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    if (user.role !== "job_seeker") return res.status(403).json({ message: "Forbidden" });
    const jobId = Number(req.body.jobId);
    if (!jobId) return res.status(400).json({ message: "jobId required" });
    const saved = await storage.saveJob(user.id, jobId);
    res.json(saved);
  });

  // DELETE /api/saved-jobs/:jobId — unsave a job
  app.delete("/api/saved-jobs/:jobId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    if (user.role !== "job_seeker") return res.status(403).json({ message: "Forbidden" });
    const jobId = Number(req.params.jobId);
    await storage.unsaveJob(user.id, jobId);
    res.status(204).end();
  });

  // Resources
  app.get(api.resources.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Login required" });
    const user = req.user as any;
    const isAdmin = user.role === "admin";
    const allResources = await storage.getResources(isAdmin ? "admin" : "public");
    if (isAdmin) return res.json(allResources);
    const role: string = user.role;
    const filtered = allResources.filter((r) => {
      if (role === "employer") return r.targetAudience === "employer" || r.targetAudience === "both";
      if (role === "job_seeker") return r.targetAudience === "job_seeker" || r.targetAudience === "both";
      return false;
    });
    res.json(filtered);
  });

  app.get("/api/resources/slug/:slug", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Login required" });
    const resource = await storage.getResourceBySlug(req.params.slug);
    if (!resource) return res.status(404).json({ message: "Not found" });
    const user = req.user as any;
    const isAdmin = user.role === "admin";
    if (!isAdmin && !resource.isPublished) return res.status(404).json({ message: "Not found" });
    if (!isAdmin) {
      const role: string = user.role;
      const allowed = role === "employer"
        ? resource.targetAudience === "employer" || resource.targetAudience === "both"
        : role === "job_seeker"
          ? resource.targetAudience === "job_seeker" || resource.targetAudience === "both"
          : false;
      if (!allowed) return res.status(403).json({ message: "This resource is not available for your account type" });
    }
    res.json(resource);
  });

  app.get("/api/resources/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Login required" });
    const resource = await storage.getResource(Number(req.params.id));
    if (!resource) return res.status(404).json({ message: "Not found" });
    const user = req.user as any;
    const isAdmin = user.role === "admin";
    if (!isAdmin && !resource.isPublished) return res.status(404).json({ message: "Not found" });
    if (!isAdmin) {
      const role: string = user.role;
      const allowed = role === "employer"
        ? resource.targetAudience === "employer" || resource.targetAudience === "both"
        : role === "job_seeker"
          ? resource.targetAudience === "job_seeker" || resource.targetAudience === "both"
          : false;
      if (!allowed) return res.status(403).json({ message: "This resource is not available for your account type" });
    }
    res.json(resource);
  });

  app.post(api.resources.create.path, async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const input = api.resources.create.input.parse(req.body);
      if (input.isPublished && (!input.bodyText || input.bodyText.trim() === "")) {
        return res.status(400).json({ message: "Cannot publish a resource with empty body text" });
      }
      const resource = await storage.createResource(input);
      res.status(201).json(resource);
    } catch (err) {
      res.status(400).json({ message: "Validation error" });
    }
  });

  // Blog
  app.get(api.blog.list.path, async (req, res) => {
    const isAdmin = req.isAuthenticated() && (req.user as any).role === "admin";
    const posts = await storage.getBlogPosts();
    res.json(isAdmin ? posts : posts.filter(p => p.isPublished));
  });

  app.get(api.blog.get.path, async (req, res) => {
    const param = req.params.id;
    const numericId = Number(param);
    const post = isNaN(numericId)
      ? await storage.getBlogPostBySlug(param)
      : (await storage.getBlogPostBySlug(param)) ?? await storage.getBlogPost(numericId);
    if (!post) return res.status(404).json({ message: "Not found" });
    const isAdmin = req.isAuthenticated() && (req.user as any).role === "admin";
    if (!isAdmin && !post.isPublished) return res.status(404).json({ message: "Not found" });
    res.json(post);
  });

  app.post(api.blog.create.path, async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const raw = api.blog.create.input.parse(req.body);
      const input = {
        ...raw,
        slug: typeof raw.slug === "string" ? raw.slug.trim() || null : raw.slug ?? null,
      };
      const post = await storage.createBlogPost(input);
      res.status(201).json(post);
    } catch (err) {
      res.status(400).json({ message: "Validation error" });
    }
  });

  // Resumes
  // GET /api/seeker-search — employer discovers seekers who have public profiles
  app.get("/api/seeker-search", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = req.user as any;
    if (user.role !== "employer" && user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const { keyword = "", track = "" } = req.query as Record<string, string>;
    const allUsers = await storage.getUsers();
    const seekers = allUsers.filter((u: any) => {
      if (u.role !== "job_seeker") return false;
      if (!u.showProfile) return false;
      // keyword match against name/email/seekerTrack
      if (keyword) {
        const kw = keyword.toLowerCase();
        const name = [(u.firstName || ""), (u.lastName || ""), (u.email || "")].join(" ").toLowerCase();
        const trackStr = (u.seekerTrack || "").toLowerCase();
        if (!name.includes(kw) && !trackStr.includes(kw)) return false;
      }
      // track filter
      if (track && u.seekerTrack !== track) return false;
      return true;
    });
    // Return sanitized data — no sensitive fields
    const result = seekers.map((u: any) => ({
      id: u.id,
      firstName: u.showName ? u.firstName : null,
      lastName: u.showName ? u.lastName : null,
      email: u.showName ? u.email : null,
      seekerTrack: u.seekerTrack,
      seekerVerificationStatus: u.seekerVerificationStatus,
      profileImage: u.profileImage,
      createdAt: u.createdAt,
    }));
    res.json(result);
  });

  app.get(api.resumes.get.path, async (req, res) => {
    if (!req.isAuthenticated() || !req.user) return res.status(401).json({ message: "Unauthorized" });
    const caller = req.user as any;
    const targetId = Number(req.params.jobSeekerId);
    if (caller.role !== "admin" && caller.id !== targetId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const userResumes = await storage.getResumes(targetId);
    res.json(userResumes);
  });

  app.post(api.resumes.create.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const input = api.resumes.create.input.parse(req.body);
      const user = req.user as any;

      input.jobSeekerId = user.id;

      const entitlements = await resolveUserEntitlements(user);
      const ent = entitlements?.["resumes_per_month"];

      if (!ent) {
        return res.status(403).json({ message: "Your plan does not include resume storage. Upgrade to add resumes.", code: "NO_ENTITLEMENT" });
      }

      if (!ent.isUnlimited) {
        const existing = await storage.getResumes(user.id);
        if (existing.length >= ent.value) {
          return res.status(403).json({
            message: `You've reached your resume limit (${ent.value}). Upgrade your plan to add more.`,
            code: "LIMIT_REACHED",
            limit: ent.value,
            current: existing.length,
          });
        }
      }

      const resume = await storage.createResume(input);
      res.status(201).json(resume);
    } catch (err) {
      res.status(400).json({ message: "Validation error" });
    }
  });

  // Resource update/delete
  app.put("/api/resources/:id", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const updates = { ...req.body };
      if (updates.publishedAt && typeof updates.publishedAt === "string") {
        updates.publishedAt = new Date(updates.publishedAt);
      }
      if (updates.isPublished) {
        const existing = await storage.getResource(Number(req.params.id));
        const bodyText = updates.bodyText !== undefined ? updates.bodyText : existing?.bodyText;
        if (!bodyText || bodyText.trim() === "") {
          return res.status(400).json({ message: "Cannot publish a resource with empty body text" });
        }
      }
      const resource = await storage.updateResource(Number(req.params.id), updates);
      res.json(resource);
    } catch (err) {
      console.error("Resource update error:", err);
      res.status(400).json({ message: "Update failed", error: (err as Error).message });
    }
  });

  app.delete("/api/resources/:id", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    await storage.deleteResource(Number(req.params.id));
    res.json({ message: "Deleted" });
  });

  // Blog update/delete
  app.put("/api/blog/:id", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const updates = { ...req.body };
      if (updates.publishedAt && typeof updates.publishedAt === "string") {
        updates.publishedAt = new Date(updates.publishedAt);
      }
      if (typeof updates.slug === "string") {
        updates.slug = updates.slug.trim() || null;
      }
      const post = await storage.updateBlogPost(Number(req.params.id), updates);
      res.json(post);
    } catch (err) {
      res.status(400).json({ message: "Update failed" });
    }
  });

  app.delete("/api/blog/:id", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    await storage.deleteBlogPost(Number(req.params.id));
    res.json({ message: "Deleted" });
  });

  // User delete
  app.delete("/api/users/:id", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    await storage.deleteUser(Number(req.params.id));
    res.json({ message: "Deleted" });
  });

  // Categories
  app.get("/api/categories", async (_req, res) => {
    const cats = await storage.getCategories();
    res.json(cats);
  });

  app.post("/api/categories", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const cat = await storage.createCategory(req.body);
      res.status(201).json(cat);
    } catch (err) {
      res.status(400).json({ message: "Validation error" });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    await storage.deleteCategory(Number(req.params.id));
    res.json({ message: "Deleted" });
  });

  // Coupons
  app.get("/api/coupons", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const allCoupons = await storage.getCoupons();
    res.json(allCoupons);
  });

  app.post("/api/coupons", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const coupon = await storage.createCoupon(req.body);
      res.status(201).json(coupon);
    } catch (err) {
      res.status(400).json({ message: "Validation error" });
    }
  });

  app.put("/api/coupons/:id", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const coupon = await storage.updateCoupon(Number(req.params.id), req.body);
      res.json(coupon);
    } catch (err) {
      res.status(400).json({ message: "Update failed" });
    }
  });

  app.delete("/api/coupons/:id", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    await storage.deleteCoupon(Number(req.params.id));
    res.json({ message: "Deleted" });
  });

  app.post("/api/coupons/validate", async (req, res) => {
    const { code, tier } = req.body;
    if (!code) return res.status(400).json({ message: "Code required" });
    const coupon = await storage.getCouponByCode(code.toUpperCase());
    if (!coupon) return res.status(404).json({ message: "Invalid coupon code" });
    if (!coupon.isActive) return res.status(400).json({ message: "Coupon is no longer active" });
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return res.status(400).json({ message: "Coupon has expired" });
    }
    if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) {
      return res.status(400).json({ message: "Coupon usage limit reached" });
    }
    if (coupon.appliesTo !== "all" && tier && coupon.appliesTo !== tier) {
      return res.status(400).json({ message: `Coupon only applies to ${coupon.appliesTo} tier` });
    }
    res.json(coupon);
  });

  app.get("/api/pages", async (req, res) => {
    const allPages = await storage.getPages();
    if (req.isAuthenticated() && (req.user as any).role === "admin") {
      res.json(allPages);
    } else {
      res.json(allPages.filter(p => p.isPublished));
    }
  });

  app.get("/api/pages/slug/:slug", async (req, res) => {
    const page = await storage.getPageBySlug(req.params.slug);
    if (!page) return res.status(404).json({ message: "Page not found" });
    if (!page.isPublished) {
      if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
        return res.status(404).json({ message: "Page not found" });
      }
    }
    res.json(page);
  });

  app.get("/api/pages/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid page ID" });
    const page = await storage.getPage(id);
    if (!page) return res.status(404).json({ message: "Page not found" });
    if (!page.isPublished) {
      if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
        return res.status(404).json({ message: "Page not found" });
      }
    }
    res.json(page);
  });

  const GUIDE_PAGES: Record<string, string> = {
    "job-seeker": "https://www.notion.so/013835e339c247d680a652935bdbccf8",
    "employer":   "https://www.notion.so/8b9930c2d9914d8d83b9a95445da5b66",
  };

  app.get("/api/content/notion-guide", async (req, res) => {
    const slug = String(req.query.slug || "");
    const pageUrl = GUIDE_PAGES[slug];
    if (!pageUrl) return res.status(404).json({ message: "Guide not found" });

    try {
      const { pageIdFromUrl, notionGetPage, notionGetAllBlocks } = await import("./notion/client.js");
      const pageId = pageIdFromUrl(pageUrl);

      const [pageRes, allBlocks] = await Promise.all([
        notionGetPage(pageId),
        notionGetAllBlocks(pageId),
      ]);

      const props = (pageRes as any).properties ?? {};
      let title = slug;
      const titleProp = props.title ?? props.Name;
      if (titleProp?.title) {
        title = titleProp.title.map((t: any) => t.plain_text).join("") || slug;
      }

      res.json({ title, blocks: allBlocks });
    } catch (err: any) {
      console.error("[notion-guide]", err?.message ?? err);
      res.status(500).json({ message: "Failed to fetch guide from Notion", detail: err?.message });
    }
  });

  function sanitizeHtml(html: string): string {
    const allowedTags = new Set([
      "h1","h2","h3","h4","h5","h6","p","br","hr","blockquote",
      "ul","ol","li","a","strong","b","em","i","u","s","del",
      "code","pre","span","div","img","table","thead","tbody","tr","th","td",
      "figure","figcaption","section","article","header","footer","main","nav",
      "sup","sub","mark","small","abbr","details","summary",
    ]);
    const allowedAttrs = new Set(["href","src","alt","title","class","id","target","rel","width","height","colspan","rowspan"]);
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, "")
      .replace(/javascript\s*:/gi, "")
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
      .replace(/<iframe[^>]*\/?>/gi, "")
      .replace(/<object[\s\S]*?<\/object>/gi, "")
      .replace(/<embed[^>]*\/?>/gi, "");
  }

  app.post("/api/pages", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const parsed = insertPageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid page data", errors: parsed.error.flatten() });
    }
    try {
      const data = { ...parsed.data, content: sanitizeHtml(parsed.data.content) };
      const page = await storage.createPage(data);
      res.json(page);
    } catch (err: any) {
      if (err.message?.includes("unique") || err.code === "23505") {
        return res.status(400).json({ message: "A page with this slug already exists" });
      }
      throw err;
    }
  });

  app.put("/api/pages/:id", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const parsed = insertPageSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid page data", errors: parsed.error.flatten() });
    }
    try {
      const data = parsed.data.content !== undefined ? { ...parsed.data, content: sanitizeHtml(parsed.data.content) } : parsed.data;
      const page = await storage.updatePage(Number(req.params.id), data);
      if (!page) return res.status(404).json({ message: "Page not found" });
      res.json(page);
    } catch (err: any) {
      if (err.message?.includes("unique") || err.code === "23505") {
        return res.status(400).json({ message: "A page with this slug already exists" });
      }
      throw err;
    }
  });

  app.delete("/api/pages/:id", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    await storage.deletePage(Number(req.params.id));
    res.json({ message: "Deleted" });
  });

  app.post(api.uploads.csv.path, (req, res) => {
    res.json({ message: "CSV uploaded successfully", count: 10 });
  });

  app.post("/api/admin/jobs/import", (req, res, next) => {
    csvUpload.single("file")(req, res, (err: any) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            message: `File exceeds maximum size of ${Math.round(MAX_CSV_FILE_BYTES / (1024 * 1024))} MB`,
          });
        }
        return res.status(400).json({ message: err.message || "File upload error" });
      }
      next();
    });
  }, async (req, res) => {
    let run: any = null;
    try {
      if (!requireAdminSession(req, res)) return;
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const user = req.user as any;
      const fileBuffer = await import("fs").then(fs => fs.readFileSync(req.file!.path));
      const csvText = fileBuffer.toString("utf-8");
      const fileHash = createHash("sha256").update(csvText).digest("hex");

      run = await storage.createImportRun({
        employerId: user.id,
        uploadedBy: user.id,
        filename: req.file.originalname,
        fileHash,
        rowsTotal: 0,
        rowsImported: 0,
        rowsSkipped: 0,
        status: "Processing",
      });

      const { headers, rows } = parseCsvText(csvText);
      if (headers.length === 0) {
        await storage.updateImportRun(run.id, { status: "Failed", rowsTotal: 0 });
        return res.status(400).json({ message: "CSV file is empty or has no headers", runId: run.id });
      }

      if (rows.length > MAX_CSV_ROWS) {
        await storage.updateImportRun(run.id, { status: "Failed", rowsTotal: rows.length });
        return res.status(400).json({
          message: `CSV contains ${rows.length} data rows, which exceeds the maximum of ${MAX_CSV_ROWS}`,
          runId: run.id,
        });
      }

      const allErrors: RowError[] = [];
      let imported = 0;
      let skipped = 0;

      // Pre-resolve employer profiles for unique company names in this CSV
      const companyEmployerMap = new Map<string, number>();
      for (const row of rows) {
        const record: Record<string, string> = {};
        headers.forEach((h, idx) => { record[h] = row[idx] || ""; });
        const companyName = (record["companyName"] || "").trim();
        if (companyName && !companyEmployerMap.has(companyName.toLowerCase())) {
          try {
            const employer = await storage.findOrCreateEmployerByCompanyName(companyName);
            companyEmployerMap.set(companyName.toLowerCase(), employer.id);
          } catch {
            // Fall back to uploader's ID if employer creation fails
            companyEmployerMap.set(companyName.toLowerCase(), user.id);
          }
        }
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const record: Record<string, string> = {};
        headers.forEach((h, idx) => { record[h] = row[idx] || ""; });

        const companyName = (record["companyName"] || "").trim();
        const resolvedEmployerId = companyName
          ? (companyEmployerMap.get(companyName.toLowerCase()) ?? user.id)
          : user.id;

        const { job, errors } = validateAndMapCsvRow(record, i + 2, resolvedEmployerId);

        if (errors.length > 0) {
          allErrors.push(...errors);
          skipped++;
          continue;
        }

        try {
          await storage.upsertJobByExternalKey(resolvedEmployerId, job.externalJobKey!, job);
          imported++;
        } catch (dbErr: any) {
          allErrors.push({
            rowNumber: i + 2,
            field: "_db",
            errorCode: "DB_ERROR",
            errorMessage: dbErr.message || "Database error during upsert",
          });
          skipped++;
        }
      }

      const status = skipped === 0 ? "Completed" : "Completed with errors";

      await storage.updateImportRun(run.id, {
        rowsTotal: rows.length,
        rowsImported: imported,
        rowsSkipped: skipped,
        status,
      });

      if (allErrors.length > 0) {
        const sanitizeCsvCell = (val: string) => {
          let s = val.replace(/"/g, '""');
          if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
          return `"${s}"`;
        };
        const errorCsvHeaders = "rowNumber,field,errorCode,errorMessage";
        const errorCsvRows = allErrors.map(e =>
          `${e.rowNumber},${sanitizeCsvCell(e.field)},${sanitizeCsvCell(e.errorCode)},${sanitizeCsvCell(e.errorMessage)}`
        );
        const errorCsv = [errorCsvHeaders, ...errorCsvRows].join("\n");

        await storage.createImportArtifact({
          runId: run.id,
          filename: "error_report.csv",
          contentType: "text/csv",
          data: errorCsv,
        });
      }

      const hasErrors = allErrors.length > 0;
      const response: Record<string, any> = {
        runId: run.id,
        status,
        rowsTotal: rows.length,
        rowsImported: imported,
        rowsSkipped: skipped,
        hasErrors,
      };
      if (hasErrors) {
        response.errorReportUrl = `/api/admin/jobs/import/${run.id}/error-report`;
      }
      res.json(response);
    } catch (err: any) {
      console.error("Import error:", err);
      if (run) {
        try { await storage.updateImportRun(run.id, { status: "Failed" }); } catch {}
      }
      res.status(500).json({ message: "Import failed: " + (err.message || "Unknown error") });
    }
  });

  // Admin: upload / update a company logo by company name
  app.post("/api/admin/employer-logo", (req, res, next) => {
    if (!requireAdminSession(req, res)) return;
    next();
  }, imageUpload.single("file"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No logo file uploaded" });
    }
    const companyName = (req.body?.companyName || "").trim();
    if (!companyName) {
      return res.status(400).json({ message: "companyName is required" });
    }
    try {
      let logoUrl: string;
      if (isR2Configured()) {
        const ext = path.extname(req.file.originalname);
        const key = `logos/${randomUUID()}${ext}`;
        logoUrl = await uploadToR2(req.file.buffer, key, req.file.mimetype);
      } else {
        const uploadsDir = path.join(process.cwd(), "uploads");
        const fs = await import("fs");
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        const ext = path.extname(req.file.originalname);
        const filename = `${randomUUID()}${ext}`;
        fs.writeFileSync(path.join(uploadsDir, filename), req.file.buffer);
        logoUrl = `/uploads/${filename}`;
      }

      const employer = await storage.findOrCreateEmployerByCompanyName(companyName);
      await storage.updateUser(employer.id, { companyLogo: logoUrl });

      res.json({ employerId: employer.id, companyName, logoUrl });
    } catch (err: any) {
      console.error("Employer logo upload error:", err);
      res.status(500).json({ message: err.message || "Logo upload failed" });
    }
  });

  // ── Taxonomy API ─────────────────────────────────────────────────────────────

  app.get("/api/taxonomy", (_req, res) => {
    res.json(getLiveTaxonomy());
  });

  app.put("/api/admin/taxonomy", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const { taxonomy } = req.body as { taxonomy: TaxonomyData };
    if (!taxonomy || typeof taxonomy !== "object" || Array.isArray(taxonomy)) {
      return res.status(400).json({ message: "taxonomy must be an object" });
    }
    for (const [industry, cats] of Object.entries(taxonomy)) {
      if (typeof industry !== "string" || typeof cats !== "object" || Array.isArray(cats) || cats === null) {
        return res.status(400).json({ message: "Each industry must map to an object of categories" });
      }
      for (const [cat, labels] of Object.entries(cats as Record<string, unknown>)) {
        if (typeof cat !== "string" || !Array.isArray(labels) || (labels as unknown[]).some(s => typeof s !== "string")) {
          return res.status(400).json({ message: "Each category must map to an array of label strings" });
        }
      }
    }
    try {
      const current = await storage.getSiteSettings();
      await storage.updateSiteSettings({ ...(current as any), job_taxonomy: taxonomy });
      setLiveTaxonomy(taxonomy);
      const catCount = Object.values(taxonomy).reduce((n, cats) => n + Object.keys(cats).length, 0);
      res.json({ ok: true, industryCount: Object.keys(taxonomy).length, categoryCount: catCount });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Email Template Admin Routes ──────────────────────────────────────────────
  const adminOnly = (req: any, res: any, next: any) => {
    if (requireAdminSession(req, res)) next();
  };

  app.get("/api/admin/email-templates", adminOnly, async (_req, res) => {
    try {
      const templates = await storage.getEmailTemplates();
      const enriched = templates.map(t => ({
        ...t,
        hasActiveTrigger: !!(t.triggerEvent && t.triggerType === "event"),
      }));
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/email-templates", adminOnly, async (req, res) => {
    try {
      const { name, slug, subject } = req.body;
      if (!name || !slug) return res.status(400).json({ message: "name and slug are required" });
      const slugClean = String(slug).toLowerCase().replace(/[^a-z0-9_]/g, "_");
      const existing = await storage.getEmailTemplateBySlug(slugClean);
      if (existing) return res.status(409).json({ message: "A template with that slug already exists" });
      const created = await storage.upsertEmailTemplate(slugClean, {
        name: String(name),
        subject: String(subject || ""),
        body: "<p>Write your email body here. Use <strong>{{variables}}</strong> to personalise it.</p>",
        variables: [],
        isActive: false,
        triggerType: null,
        triggerEvent: null,
      });
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/trigger-events", adminOnly, async (_req, res) => {
    const { TRIGGER_EVENTS } = await import("../shared/triggerEvents.ts");
    res.json(TRIGGER_EVENTS);
  });

  app.get("/api/admin/email-templates/:slug", adminOnly, async (req, res) => {
    try {
      const t = await storage.getEmailTemplateBySlug(req.params.slug);
      if (!t) return res.status(404).json({ message: "Template not found" });
      const { DEFAULT_TEMPLATES } = await import("./email/templateSeeds.ts");
      const seed = DEFAULT_TEMPLATES.find(s => s.slug === req.params.slug);
      res.json({ ...t, hasActiveTrigger: seed?.hasActiveTrigger ?? true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/admin/email-templates/:slug", adminOnly, async (req, res) => {
    try {
      const { subject, body, variables, isActive, triggerType, triggerEvent } = req.body;
      const updated = await storage.upsertEmailTemplate(req.params.slug, {
        ...(subject !== undefined ? { subject } : {}),
        ...(body !== undefined ? { body } : {}),
        ...(variables !== undefined ? { variables } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(triggerType !== undefined ? { triggerType } : {}),
        ...(triggerEvent !== undefined ? { triggerEvent: triggerEvent || null } : {}),
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Rate-limit map: adminId → last test send timestamp
  const testEmailRateLimit = new Map<number, number>();

  app.post("/api/admin/email-templates/:slug/test", adminOnly, async (req, res) => {
    const adminId = (req.user as any).id;
    const last = testEmailRateLimit.get(adminId);
    if (last && Date.now() - last < 30_000) {
      return res.status(429).json({ message: "Please wait 30 seconds between test sends." });
    }
    try {
      const template = await storage.getEmailTemplateBySlug(req.params.slug);
      if (!template) return res.status(404).json({ message: "Template not found" });

      const { DEFAULT_TEMPLATES } = await import("./email/templateSeeds.ts");
      const seed = DEFAULT_TEMPLATES.find(s => s.slug === req.params.slug);
      const testVars = seed?.testVars ?? {};

      const { renderEmailTemplate } = await import("./email/templateEngine.ts");
      const rendered = renderEmailTemplate(template.subject, template.body, testVars);

      const apiKey = process.env.MAILGUN_API_KEY;
      const domain = process.env.MAILGUN_DOMAIN;
      if (!apiKey || !domain) {
        return res.status(500).json({ message: "Mailgun is not configured. Set MAILGUN_API_KEY and MAILGUN_DOMAIN." });
      }
      const FormData = (await import("form-data")).default;
      const Mailgun = (await import("mailgun.js")).default;
      const mg = new Mailgun(FormData).client({ username: "api", key: apiKey });
      const fromName = process.env.MAILGUN_FROM_NAME || "LaneLogic Jobs";
      const fromEmail = process.env.MAILGUN_FROM_EMAIL || `no-reply@${domain}`;
      const isHtml = rendered.body.trimStart().startsWith("<");
      await mg.messages.create(domain, {
        from: `${fromName} <${fromEmail}>`,
        to: [(req.user as any).email],
        subject: `[TEST] ${rendered.subject}`,
        ...(isHtml ? { html: rendered.body } : { text: rendered.body }),
      });

      testEmailRateLimit.set(adminId, Date.now());
      res.json({ message: `Test email sent to ${(req.user as any).email}` });
    } catch (err: any) {
      console.error("[email] Test send error:", err);
      res.status(500).json({ message: err.message || "Test send failed" });
    }
  });

  // ── Email Cron Configs ────────────────────────────────────────────────────

  // Shared whitelist constants (mirrors server/cron/scheduledEmails.ts)
  const CRON_ALLOWED_TABLES = new Set(["users", "jobs", "applications"]);
  const CRON_ALLOWED_FIELDS: Record<string, Set<string>> = {
    users: new Set([
      "id", "email", "first_name", "last_name", "role", "company_name",
      "created_at", "resume_access_expires_at", "featured_employer_expires_at",
      "seeker_track", "is_active",
    ]),
    jobs: new Set([
      "id", "employer_id", "title", "company_name", "expires_at",
      "created_at", "is_published", "status", "category",
    ]),
    applications: new Set([
      "id", "job_id", "job_seeker_id", "employer_id", "status", "created_at",
    ]),
  };
  const CRON_JOIN_BLOCKLIST = /\b(DROP|DELETE|UPDATE|INSERT|EXEC|UNION|ALTER|TRUNCATE)\b|;|--|\*\/|\/\*/i;

  function validateCronRecipientJoin(joinStr: string | null | undefined): string | null {
    if (!joinStr) return null;
    if (CRON_JOIN_BLOCKLIST.test(joinStr)) return "recipient_join contains a blocked SQL keyword";
    // Validate every JOIN target in the string (handles multiple JOINs)
    const joinMatches = Array.from(joinStr.matchAll(/\bJOIN\s+(\w+)/gi));
    for (const m of joinMatches) {
      if (!CRON_ALLOWED_TABLES.has(m[1].toLowerCase())) {
        return `Join target "${m[1]}" is not in the allowed tables list`;
      }
    }
    return null;
  }

  app.get("/api/admin/email-cron-configs/schema", adminOnly, (_req, res) => {
    const allowedFields: Record<string, string[]> = {};
    for (const [table, fields] of Object.entries(CRON_ALLOWED_FIELDS)) {
      allowedFields[table] = Array.from(fields);
    }
    res.json({
      allowedTables: Array.from(CRON_ALLOWED_TABLES),
      allowedFields,
    });
  });

  app.get("/api/admin/email-cron-configs", adminOnly, async (_req, res) => {
    try {
      const configs = await storage.getEmailCronConfigs();
      res.json(configs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/email-cron-configs/:id", adminOnly, async (req, res) => {
    try {
      const config = await storage.getEmailCronConfig(Number(req.params.id));
      if (!config) return res.status(404).json({ message: "Not found" });
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/email-cron-configs", adminOnly, async (req, res) => {
    try {
      const parsed = insertEmailCronConfigSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      const joinErr = validateCronRecipientJoin(parsed.data.recipientJoin);
      if (joinErr) return res.status(400).json({ message: joinErr });
      const config = await storage.createEmailCronConfig(parsed.data);
      res.status(201).json(config);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/admin/email-cron-configs/:id", adminOnly, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const parsed = insertEmailCronConfigSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      const joinErr = validateCronRecipientJoin(parsed.data.recipientJoin);
      if (joinErr) return res.status(400).json({ message: joinErr });
      const config = await storage.updateEmailCronConfig(id, parsed.data);
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/email-cron-configs/:id", adminOnly, async (req, res) => {
    try {
      await storage.deleteEmailCronConfig(Number(req.params.id));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/email-cron-configs/:id/toggle", adminOnly, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await storage.getEmailCronConfig(id);
      if (!existing) return res.status(404).json({ message: "Not found" });
      const updated = await storage.updateEmailCronConfig(id, { isActive: !existing.isActive });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/email-cron-configs/:id/test", adminOnly, async (req, res) => {
    const adminId = (req.user as any).id;
    const last = testEmailRateLimit.get(adminId);
    if (last && Date.now() - last < 30_000) {
      return res.status(429).json({ message: "Please wait 30 seconds between test sends." });
    }
    try {
      const config = await storage.getEmailCronConfig(Number(req.params.id));
      if (!config) return res.status(404).json({ message: "Config not found" });

      const template = await storage.getEmailTemplateBySlug(
        (await storage.getEmailTemplates()).find(t => t.id === config.templateId)?.slug ?? ""
      );
      if (!template) return res.status(404).json({ message: "Associated template not found" });

      const { DEFAULT_TEMPLATES } = await import("./email/templateSeeds.ts");
      const seed = DEFAULT_TEMPLATES.find(s => s.slug === template.slug);
      const fallbackVars: Record<string, string> = (seed?.testVars as Record<string, string>) ?? {};

      let liveVars: Record<string, string> | null = null;
      let dataSource: "live_data" | "sample_data" = "sample_data";
      let liveQueryError: string | null = null;

      if (CRON_ALLOWED_TABLES.has(config.sourceTable)) {
        const join = config.recipientJoin ?? "";
        const joinErr = validateCronRecipientJoin(join);
        if (joinErr) {
          liveQueryError = joinErr;
        } else {
          // Validate trigger field
          const bareField = config.triggerField.includes(".")
            ? config.triggerField.split(".").pop()!
            : config.triggerField;
          if (!CRON_ALLOWED_FIELDS[config.sourceTable]?.has(bareField)) {
            liveQueryError = `Trigger field "${config.triggerField}" is not in the allowed list`;
          } else {
            try {
              const joinedTable = join ? join.match(/\bJOIN\s+(\w+)/i)?.[1] : null;
              const selectCols = joinedTable
                ? `${config.sourceTable}.*, ${joinedTable}.*`
                : `${config.sourceTable}.*`;
              const offsetDays = Number(config.triggerOffsetDays) || 0;
              const intervalExpr = config.triggerDirection === "before"
                ? `CURRENT_DATE + INTERVAL '${offsetDays} days'`
                : `CURRENT_DATE - INTERVAL '${offsetDays} days'`;

              const params: unknown[] = [];
              const whereParts: string[] = [
                `${config.sourceTable}.${bareField}::date = ${intervalExpr}`,
              ];
              const safeBoolOps = new Set(["=", "!=", ">", "<", ">=", "<="]);
              for (const cond of (config.filterConditions ?? []) as Array<{ field: string; operator: string; value: string }>) {
                const col = cond.field.includes(".") ? cond.field.split(".").pop()! : cond.field;
                if (!CRON_ALLOWED_FIELDS[config.sourceTable]?.has(col)) continue;
                if (cond.operator === "IS NULL") {
                  whereParts.push(`${config.sourceTable}.${col} IS NULL`);
                } else if (cond.operator === "IS NOT NULL") {
                  whereParts.push(`${config.sourceTable}.${col} IS NOT NULL`);
                } else {
                  const op = safeBoolOps.has(cond.operator) ? cond.operator : "=";
                  params.push(cond.value);
                  whereParts.push(`${config.sourceTable}.${col} ${op} $${params.length}`);
                }
              }

              const qResult = await pool.query(
                `SELECT ${selectCols} FROM ${config.sourceTable} ${join} WHERE ${whereParts.join(" AND ")} LIMIT 1`,
                params
              );

              if (qResult.rows.length > 0) {
                const row = qResult.rows[0];
                const vars: Record<string, string> = {
                  site_name: "LaneLogic Jobs",
                  site_url: process.env.CANONICAL_HOST || "https://lanelogicjobs.com",
                  dashboard_url: `${process.env.CANONICAL_HOST || "https://lanelogicjobs.com"}/dashboard`,
                };
                for (const [token, mapping] of Object.entries(config.variableMappings ?? {})) {
                  if (typeof mapping === "string" && mapping.startsWith("literal:")) {
                    vars[token] = mapping.slice("literal:".length);
                  } else {
                    const col = String(mapping).split(".").pop() ?? String(mapping);
                    const colVal = row[col];
                    vars[token] = colVal instanceof Date
                      ? colVal.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                      : String(colVal ?? "");
                  }
                }
                liveVars = vars;
                dataSource = "live_data";
              }
            } catch (err: any) {
              console.warn(`[cron-config] Live query failed for config id=${config.id}:`, err?.message);
              liveQueryError = err?.message ?? "Live query failed";
            }
          }
        }
      }

      const variablesUsed = liveVars ?? fallbackVars;

      const { renderEmailTemplate } = await import("./email/templateEngine.ts");
      const rendered = renderEmailTemplate(template.subject, template.body, variablesUsed);

      const apiKey = process.env.MAILGUN_API_KEY;
      const domain = process.env.MAILGUN_DOMAIN;
      if (!apiKey || !domain) {
        return res.status(500).json({ message: "Mailgun is not configured." });
      }

      const FormData = (await import("form-data")).default;
      const Mailgun = (await import("mailgun.js")).default;
      const mg = new Mailgun(FormData).client({ username: "api", key: apiKey });
      const fromName = process.env.MAILGUN_FROM_NAME || "LaneLogic Jobs";
      const fromEmail = process.env.MAILGUN_FROM_EMAIL || `no-reply@${domain}`;
      const isHtml = rendered.body.trimStart().startsWith("<");

      await mg.messages.create(domain, {
        from: `${fromName} <${fromEmail}>`,
        to: [(req.user as any).email],
        subject: `[TEST] ${rendered.subject}`,
        ...(isHtml ? { html: rendered.body } : { text: rendered.body }),
      });

      testEmailRateLimit.set(adminId, Date.now());
      res.json({
        message: `Test email sent to ${(req.user as any).email}`,
        source: dataSource,
        variablesUsed,
        ...(liveQueryError ? { liveQueryWarning: liveQueryError } : {}),
      });
    } catch (err: any) {
      console.error("[cron-config] Test send error:", err);
      res.status(500).json({ message: err.message || "Test send failed" });
    }
  });

  app.post("/api/admin/jobs/migrate-paragraphize", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const allJobs = await db.select({ id: jobs.id, description: jobs.description }).from(jobs);
      let updated = 0;
      for (const job of allJobs) {
        if (!job.description) continue;
        const newlineCount = (job.description.match(/\n/g) || []).length;
        if (newlineCount >= 2) continue;
        const newDesc = paragraphize(job.description);
        if (newDesc !== job.description) {
          await db.update(jobs).set({ description: newDesc }).where(eq(jobs.id, job.id));
          updated++;
        }
      }
      res.json({ message: `Paragraphized ${updated} job descriptions`, updated });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  const LEGACY_CATEGORY_MAP: Record<string, string | null> = {
    "driver": "Drivers (CDL & Non-CDL)",
    "driving": "Drivers (CDL & Non-CDL)",
    "driving | transport": "Drivers (CDL & Non-CDL)",
    "driving | otr": "Drivers (CDL & Non-CDL)",
    "otr": "Drivers (CDL & Non-CDL)",
    "local": "Drivers (CDL & Non-CDL)",
    "flatbed": "Drivers (CDL & Non-CDL)",
    "tanker | hazmat": "Drivers (CDL & Non-CDL)",
    "owner-operator": "Drivers (CDL & Non-CDL)",
    "dispatch": "Ground Transportation Ops (Dispatch, Planning, Fleet)",
    "dispatcher": "Ground Transportation Ops (Dispatch, Planning, Fleet)",
    "warehouse": "Warehousing & Distribution (DC Ops)",
    "operators": "Warehousing & Distribution (DC Ops)",
    "operations management - district": "Leadership & Management",
    "operations management - frontline": "Leadership & Management",
    "operations support": "Leadership & Management",
    "account management": "Customer Service & Account Management",
    "accounts payable": "Finance, Billing, Claims & Audit",
    "ce inbound sales and service": "Customer Service & Account Management",
    "technicians": null,
    "mechanic": null,
    "intern": null,
    "it project management": null,
    "welding": null,
    "sustainability and environmental services": null,
  };

  app.post("/api/admin/jobs/migrate-categories", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const allJobs = await db.select({ id: jobs.id, category: jobs.category }).from(jobs);
      let mapped = 0;
      let cleared = 0;
      let unchanged = 0;
      for (const job of allJobs) {
        if (!job.category || job.category.trim() === "") { unchanged++; continue; }
        const normalized = normalizeCategory(job.category);
        if (normalized) {
          if (normalized !== job.category) {
            await db.update(jobs).set({ category: normalized }).where(eq(jobs.id, job.id));
            mapped++;
          } else {
            unchanged++;
          }
          continue;
        }
        const legacyMapping = LEGACY_CATEGORY_MAP[job.category.toLowerCase()];
        if (legacyMapping !== undefined) {
          await db.update(jobs).set({ category: legacyMapping }).where(eq(jobs.id, job.id));
          if (legacyMapping) mapped++; else cleared++;
        } else {
          await db.update(jobs).set({ category: null }).where(eq(jobs.id, job.id));
          cleared++;
        }
      }
      res.json({ message: `Category migration complete`, mapped, cleared, unchanged, total: allJobs.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/migrate-uploads-to-r2", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    if (!isR2Configured()) {
      return res.status(400).json({ message: "R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL." });
    }
    try {
      const fs = await import("fs");
      const uploadsDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadsDir)) {
        return res.json({ message: "No uploads directory found", migrated: 0, updated: 0 });
      }
      const imageExts = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
      const files = fs.readdirSync(uploadsDir).filter(f => imageExts.test(f));
      const urlMap = new Map<string, string>();
      let migrated = 0;
      for (const file of files) {
        const filePath = path.join(uploadsDir, file);
        const buffer = fs.readFileSync(filePath);
        const ext = path.extname(file).toLowerCase();
        const mimeMap: Record<string, string> = {
          ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
          ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
        };
        const contentType = mimeMap[ext] || "application/octet-stream";
        const r2Url = await uploadToR2(buffer, file, contentType);
        urlMap.set(`/uploads/${file}`, r2Url);
        migrated++;
      }
      let updated = 0;
      const settingsData = await storage.getSiteSettings() as Record<string, any>;
      if (settingsData && typeof settingsData === "object") {
        let settingsChanged = false;
        for (const [key, value] of Object.entries(settingsData)) {
          if (typeof value === "string" && urlMap.has(value)) {
            settingsData[key] = urlMap.get(value)!;
            settingsChanged = true;
            updated++;
          }
        }
        if (settingsChanged) {
          await storage.updateSiteSettings(settingsData);
        }
      }
      const allUsers = await storage.getUsers();
      for (const user of allUsers) {
        const updates: Record<string, string> = {};
        if (user.profileImage && urlMap.has(user.profileImage)) {
          updates.profileImage = urlMap.get(user.profileImage)!;
        }
        if (user.companyLogo && urlMap.has(user.companyLogo)) {
          updates.companyLogo = urlMap.get(user.companyLogo)!;
        }
        if (Object.keys(updates).length > 0) {
          await storage.updateUser(user.id, updates);
          updated += Object.keys(updates).length;
        }
      }
      res.json({ message: "Migration complete", migrated, updated, urlMap: Object.fromEntries(urlMap) });
    } catch (err: any) {
      console.error("R2 migration error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/jobs/import/runs", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const runs = await storage.getImportRuns();
    res.json(runs);
  });

  app.get("/api/admin/jobs/import/:runId", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const run = await storage.getImportRun(Number(req.params.runId));
    if (!run) return res.status(404).json({ message: "Import run not found" });
    res.json(run);
  });

  app.get("/api/admin/jobs/import/:runId/error-report", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const artifact = await storage.getImportArtifact(Number(req.params.runId), "error_report.csv");
    if (!artifact) return res.status(404).json({ message: "Error report not found" });
    res.set("Content-Type", "text/csv");
    res.set("Content-Disposition", `attachment; filename="error_report_run_${req.params.runId}.csv"`);
    res.send(artifact.data);
  });

  // Stripe public key (for frontend)
  app.get("/api/payments/config", async (req, res) => {
    try {
      const { getStripePublishableKey } = await import("./stripeClient");
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch {
      res.status(503).json({ message: "Payment system not configured." });
    }
  });

  app.get("/api/user/entitlements", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const user = req.user as any;
      const entitlements = await resolveUserEntitlements(user);
      res.json({ entitlements });
    } catch (err: any) {
      console.error("Entitlements error:", err);
      res.status(500).json({ message: "Failed to load entitlements" });
    }
  });

  app.get("/api/user/quota-status", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const user = req.user as any;
      const keys = ["applications_per_month", "job_posts_per_month"];
      const quotas: Record<string, any> = {};
      for (const key of keys) {
        quotas[key] = await getQuotaStatus(user, key);
      }
      res.json({ quotas });
    } catch (err: any) {
      console.error("Quota status error:", err);
      res.status(500).json({ message: "Failed to load quota status" });
    }
  });

  app.get("/api/registry/pricing", async (_req, res) => {
    try {
      const data = await getPricingData();
      if (!data) {
        return res.status(503).json({ message: "Pricing data not available yet" });
      }
      res.json(data);
    } catch (err: any) {
      console.error("Pricing data error:", err);
      res.status(500).json({ message: "Failed to load pricing data" });
    }
  });



  app.post("/api/payments/create-checkout-session", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { stripePriceId, tier, planType } = req.body;

    try {
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      const user = req.user as any;

      let resolvedPriceId = stripePriceId || null;
      const isTopUp = planType === "Top-up";

      if (!resolvedPriceId && tier && ["basic", "premium"].includes(tier)) {
        const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
        const roleLabel = user.role === "employer" ? "Employer" : "Job Seeker";
        const productName = `LaneLogic Jobs ${tierLabel} - ${roleLabel}`;
        const products = await stripe.products.search({ query: `name:'${productName}' AND active:'true'` });
        if (products.data.length > 0) {
          const prices = await stripe.prices.list({ product: products.data[0].id, active: true, limit: 1 });
          if (prices.data.length > 0) resolvedPriceId = prices.data[0].id;
        }
      }

      if (!resolvedPriceId) {
        return res.status(400).json({ message: "No valid price found for this plan" });
      }

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { userId: String(user.id) },
        });
        customerId = customer.id;
        await storage.updateUser(user.id, { stripeCustomerId: customerId } as any);
      }

      const sessionParams: any = {
        customer: customerId,
        payment_method_types: ["card"],
        mode: isTopUp ? "payment" : "subscription",
        line_items: [{ price: resolvedPriceId, quantity: 1 }],
        success_url: isTopUp
          ? `${req.protocol}://${req.get("host")}/dashboard/membership?success=true&addon=true&session_id={CHECKOUT_SESSION_ID}`
          : `${req.protocol}://${req.get("host")}/dashboard/membership?success=true`,
        cancel_url: `${req.protocol}://${req.get("host")}/pricing`,
        metadata: { userId: String(user.id), tier: tier || "", planType: planType || "Subscription", stripePriceId: resolvedPriceId },
      };

      const session = await stripe.checkout.sessions.create(sessionParams);
      res.json({ url: session.url, sessionId: session.id });
    } catch (err: any) {
      console.error("Stripe checkout error:", err);
      res.status(500).json({ message: err.message || "Payment error" });
    }
  });

  const fulfilledSessions = new Set<string>();

  app.post("/api/payments/fulfill-addon", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ message: "Missing sessionId" });

    if (fulfilledSessions.has(sessionId)) {
      return res.json({ message: "Already fulfilled", alreadyFulfilled: true });
    }

    try {
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      const userId = parseInt(session.metadata?.userId || "0", 10);
      const user = req.user as any;
      if (userId !== user.id) {
        return res.status(403).json({ message: "Session does not belong to this user" });
      }

      const { fulfillTopUpFromSession } = await import("./utils/fulfillTopUp");
      const result = await fulfillTopUpFromSession({
        payment_status: session.payment_status,
        payment_intent: session.payment_intent as string | null,
        metadata: session.metadata as Record<string, string> | null,
      });

      if (!result.fulfilled) {
        return res.status(400).json({ message: result.reason });
      }

      fulfilledSessions.add(sessionId);

      if (result.type === "already_fulfilled") {
        return res.json({ message: "Already fulfilled", alreadyFulfilled: true });
      }
      if (result.type === "credit_grant") {
        return res.json({ message: `${result.credits} credits granted`, credits: result.credits, expiresAt: result.expiresAt });
      }
      if (result.type === "resume_access") {
        return res.json({ message: "Resume Access activated", expiresAt: result.expiresAt });
      }
      if (result.type === "featured_employer") {
        return res.json({ message: "Featured Employer activated", expiresAt: result.expiresAt });
      }

      return res.json({ message: "Fulfilled" });
    } catch (err: any) {
      console.error("Add-on fulfillment error:", err);
      res.status(500).json({ message: err.message || "Fulfillment error" });
    }
  });

  // Customer portal (manage subscription)
  app.post("/api/payments/portal", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    const user = req.user as any;
    if (!user.stripeCustomerId) return res.status(400).json({ message: "No active subscription" });

    try {
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${req.protocol}://${req.get("host")}/dashboard/membership`,
      });
      res.json({ url: session.url });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Site Settings
  app.get("/api/settings", async (_req, res) => {
    try {
      const settings = await storage.getSiteSettings();
      res.json(settings);
    } catch (err) {
      res.status(500).json({ message: "Could not load settings" });
    }
  });

  app.put("/api/settings", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const body = req.body;
      const footerFields = ["footerTextColor", "footerLinkColor", "footerLinkHoverColor", "footerBgColor", "pageBackgroundColor"];
      const hasFooterChange = footerFields.some(f => body[f] !== undefined) || body.footerBgOpacity !== undefined;

      if (hasFooterChange) {
        const { normalizeHex, checkFooterContrast } = await import("@shared/colorUtils");
        const current = await storage.getSiteSettings();
        const merged = { ...current, ...body };

        for (const f of ["footerTextColor", "footerLinkColor", "footerLinkHoverColor", "footerBgColor", "pageBackgroundColor"] as const) {
          if (body[f] !== undefined) {
            if (typeof body[f] !== "string" || body[f].trim() === "") {
              return res.status(400).json({ message: `${f} must be a non-empty hex color string` });
            }
            const normalized = normalizeHex(body[f]);
            if (!normalized) {
              return res.status(400).json({ message: `${f} is not a valid hex color` });
            }
            body[f] = normalized;
            merged[f] = normalized;
          }
        }

        if (merged.footerBgOpacity !== undefined) {
          const op = Number(merged.footerBgOpacity);
          if (isNaN(op) || op < 0 || op > 1) {
            return res.status(400).json({ message: "footerBgOpacity must be between 0 and 1" });
          }
        }

        const checks = checkFooterContrast(
          merged.footerBgColor || "#0b1220",
          merged.footerBgOpacity ?? 1,
          merged.pageBackgroundColor || "#ffffff",
          merged.footerTextColor || "#e5e7eb",
          merged.footerLinkColor || "#93c5fd",
          merged.footerLinkHoverColor || "#bfdbfe",
        );
        const failures = checks.filter(c => !c.passes);
        if (failures.length > 0) {
          return res.status(400).json({
            message: "Contrast check failed",
            errors: failures.map(f => ({
              field: f.field,
              reason: "contrast_failed",
              ratio: f.ratio,
              min: 4.5,
              message: f.message,
            })),
          });
        }
      }

      const settings = await storage.updateSiteSettings(body);
      res.json(settings);
    } catch (err) {
      res.status(500).json({ message: "Could not save settings" });
    }
  });

  app.patch("/api/profile", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const userId = (req.user as any).id;
      const allowed = ["firstName", "lastName", "companyName", "companyAddress", "contactName", "contactEmail", "contactPhone", "aboutCompany", "profileImage", "companyLogo", "showProfile", "showName", "showCurrentEmployer"];
      const updates: Record<string, any> = {};
      for (const key of allowed) {
        if (key in req.body) updates[key] = req.body[key];
      }
      const user = await storage.updateUser(userId, updates);
      res.json(user);
    } catch (err) {
      res.status(500).json({ message: "Could not update profile" });
    }
  });

  app.use("/uploads", (await import("express")).default.static(path.join(process.cwd(), "uploads")));

  app.post("/api/upload", (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  }, imageUpload.single("file"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    try {
      if (isR2Configured()) {
        const ext = path.extname(req.file.originalname);
        const key = `${randomUUID()}${ext}`;
        const url = await uploadToR2(req.file.buffer, key, req.file.mimetype);
        return res.json({ url });
      }
      const uploadsDir = path.join(process.cwd(), "uploads");
      const fs = await import("fs");
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      const ext = path.extname(req.file.originalname);
      const filename = `${randomUUID()}${ext}`;
      fs.writeFileSync(path.join(uploadsDir, filename), req.file.buffer);
      res.json({ url: `/uploads/${filename}` });
    } catch (err: any) {
      console.error("Upload error:", err);
      res.status(500).json({ message: err.message || "Upload failed" });
    }
  });

  // Contact form rate limiting (5 requests per IP per 15 minutes)
  const contactRateMap = new Map<string, number[]>();
  function checkContactRate(ip: string): boolean {
    const now = Date.now();
    const window = 15 * 60 * 1000;
    const attempts = (contactRateMap.get(ip) || []).filter(t => now - t < window);
    if (attempts.length >= 5) return false;
    attempts.push(now);
    contactRateMap.set(ip, attempts);
    return true;
  }

  function escapeHtml(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // Contact form — send email via Mailgun
  app.post("/api/contact", async (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    if (!checkContactRate(clientIp)) {
      return res.status(429).json({ success: false, message: "Too many requests. Please try again later." });
    }

    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }

    const apiKey = process.env.MAILGUN_API_KEY;
    const domain = process.env.MAILGUN_DOMAIN;
    if (!apiKey || !domain) {
      console.error("Mailgun credentials not configured");
      return res.status(500).json({ success: false, message: "Email service not configured" });
    }

    try {
      const FormData = (await import("form-data")).default;
      const Mailgun = (await import("mailgun.js")).default;
      const mailgun = new Mailgun(FormData);
      const mg = mailgun.client({ username: "api", key: apiKey });

      const safeName = escapeHtml(name);
      const safeEmail = escapeHtml(email);
      const safeSubject = escapeHtml(subject);
      const safeMessage = escapeHtml(message);

      await mg.messages.create(domain, {
        from: `${safeName} <noreply@${domain}>`,
        to: [`contact@${domain}`],
        "h:Reply-To": email,
        subject: `[Contact Form] ${subject}`,
        text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}`,
        html: `<h3>New Contact Form Submission</h3>
<p><strong>Name:</strong> ${safeName}</p>
<p><strong>Email:</strong> ${safeEmail}</p>
<p><strong>Subject:</strong> ${safeSubject}</p>
<hr/>
<p>${safeMessage.replace(/\n/g, "<br/>")}</p>`,
      });

      res.json({ success: true, message: "Message sent successfully!" });
    } catch (error: any) {
      console.error("Mailgun error:", error?.message || error);
      res.status(500).json({ success: false, message: "Failed to send message. Please try again later." });
    }
  });

  // ── Messaging ───────────────────────────────────────────────────────────────

  // GET /api/conversations – list my conversations
  app.get("/api/conversations", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const userId = (req.user as any).id;
    const convs = await storage.getConversations(userId);
    res.json(convs);
  });

  // GET /api/conversations/unread-count – unread badge count
  app.get("/api/conversations/unread-count", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const count = await storage.getUnreadMessageCount((req.user as any).id);
    res.json({ count });
  });

  // POST /api/conversations – get or create a conversation
  app.post("/api/conversations", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { seekerId, employerId, jobId } = req.body;
    if (!seekerId || !employerId) return res.status(400).json({ error: "seekerId and employerId required" });
    const conv = await storage.getOrCreateConversation(Number(seekerId), Number(employerId), jobId ? Number(jobId) : null);
    res.json(conv);
  });

  // GET /api/conversations/:id/messages
  app.get("/api/conversations/:id/messages", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const userId = (req.user as any).id;
    const convId = Number(req.params.id);
    const conv = await storage.getConversation(convId);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });
    if (conv.seekerId !== userId && conv.employerId !== userId) return res.status(403).json({ error: "Forbidden" });
    const msgs = await storage.getMessages(convId);
    res.json(msgs);
  });

  // POST /api/conversations/:id/messages – send a message
  app.post("/api/conversations/:id/messages", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const userId = (req.user as any).id;
    const convId = Number(req.params.id);
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "Content required" });
    const conv = await storage.getConversation(convId);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });
    if (conv.seekerId !== userId && conv.employerId !== userId) return res.status(403).json({ error: "Forbidden" });
    // Check unread count BEFORE inserting so we know if the recipient was already
    // waiting on unread messages. If they were, they already got a notification
    // email for this thread — skip sending another to avoid inbox spam.
    const recipientId = conv.seekerId === userId ? conv.employerId : conv.seekerId;
    const existingUnread = await storage.getConversationUnreadCount(convId, recipientId);

    const msg = await storage.createMessage(convId, userId, content.trim());

    // Email notification to recipient via template (fire-and-forget)
    // Only fires when the recipient had no prior unread messages in this thread.
    if (existingUnread === 0) {
      const [sender, recipient] = await Promise.all([
        storage.getUser(userId),
        storage.getUser(recipientId),
      ]);
      if (sender && recipient) {
        (async () => {
          try {
            const { sendTemplatedEmailByEvent } = await import("./email/sendTemplatedEmail.ts");
            const senderName = [(sender as any).firstName, (sender as any).lastName].filter(Boolean).join(" ") || (sender as any).companyName || (sender as any).email;
            const preview = content.trim().slice(0, 200);
            const siteUrl = process.env.CANONICAL_HOST || "https://lanelogicjobs.com";
            await sendTemplatedEmailByEvent("message_sent", (recipient as any).email, {
              first_name: (recipient as any).firstName || (recipient as any).email,
              sender_name: senderName,
              message_preview: preview,
              inbox_url: `${siteUrl}/dashboard/messages`,
              site_url: siteUrl,
            });
          } catch (e: any) {
            console.error("Messaging email notification failed:", e?.message);
          }
        })();
      }
    }

    res.json(msg);
  });

  // POST /api/conversations/:id/read – mark as read
  app.post("/api/conversations/:id/read", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const userId = (req.user as any).id;
    const convId = Number(req.params.id);
    const conv = await storage.getConversation(convId);
    if (!conv) return res.status(404).json({ error: "Not found" });
    if (conv.seekerId !== userId && conv.employerId !== userId) return res.status(403).json({ error: "Forbidden" });
    await storage.markConversationRead(convId, userId);
    res.json({ ok: true });
  });

  // Sitemap
  app.get("/robots.txt", (_req, res) => {
    const canonicalHost = process.env.CANONICAL_HOST || `${_req.protocol}://${_req.get("host")}`;
    const privateDisallows = [
      "Disallow: /admin/",
      "Disallow: /api/",
      "Disallow: /dashboard/",
      "Disallow: /login",
      "Disallow: /register",
    ];
    const lines = [
      "User-agent: *",
      "Allow: /",
      ...privateDisallows,
      "",
      "User-agent: GPTBot",
      "Allow: /",
      ...privateDisallows,
      "",
      "User-agent: ChatGPT-User",
      "Allow: /",
      ...privateDisallows,
      "",
      "User-agent: ClaudeBot",
      "Allow: /",
      ...privateDisallows,
      "",
      `Sitemap: ${canonicalHost}/sitemap.xml`,
    ];
    res.set("Content-Type", "text/plain");
    res.send(lines.join("\n"));
  });

  app.get("/sitemap.xml", async (_req, res) => {
    const canonicalHost = process.env.CANONICAL_HOST || `${_req.protocol}://${_req.get("host")}`;
    const now = new Date().toISOString().split("T")[0];

    const staticPages = ["/", "/jobs", "/blog", "/resources", "/pricing", "/contact", "/employers"];
    let urls = staticPages.map(
      (p) => `  <url><loc>${canonicalHost}${p}</loc><changefreq>weekly</changefreq><priority>${p === "/" ? "1.0" : "0.8"}</priority></url>`
    );

    for (const cat of JOB_CATEGORIES) {
      for (const state of Object.keys(SEO_STATES)) {
        urls.push(`  <url><loc>${canonicalHost}/jobs/${cat.slug}-jobs-${state}</loc><changefreq>daily</changefreq><priority>0.7</priority></url>`);
      }
    }

    try {
      const allJobs = await storage.getJobs();
      const publishedJobs = allJobs.filter((j) => j.isPublished && (!j.expiresAt || new Date(j.expiresAt) > new Date()));
      for (const job of publishedJobs) {
        const lastmod = job.publishedAt ? new Date(job.publishedAt).toISOString().split("T")[0] : now;
        urls.push(`  <url><loc>${canonicalHost}/jobs/${job.id}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>`);
      }

      const allBlogs = await storage.getBlogPosts();
      const publishedBlogs = allBlogs.filter((b) => b.isPublished);
      for (const blog of publishedBlogs) {
        const blogSlug = blog.slug || String(blog.id);
        const lastmod = blog.updatedAt
          ? new Date(blog.updatedAt).toISOString().split("T")[0]
          : blog.publishedAt ? new Date(blog.publishedAt).toISOString().split("T")[0] : now;
        urls.push(`  <url><loc>${canonicalHost}/blog/${blogSlug}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`);
      }

      const allPages = await storage.getPages();
      const publishedPages = allPages.filter((p) => p.isPublished && p.slug);
      for (const page of publishedPages) {
        const lastmod = page.updatedAt ? new Date(page.updatedAt).toISOString().split("T")[0] : now;
        urls.push(`  <url><loc>${canonicalHost}/pages/${page.slug}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.5</priority></url>`);
      }
    } catch (err) {
      console.error("[sitemap] Error fetching dynamic entities:", err);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

    res.set("Content-Type", "application/xml");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(xml);
  });

  app.get("/llms.txt", (_req, res) => {
    const canonicalHost = process.env.CANONICAL_HOST || `${_req.protocol}://${_req.get("host")}`;
    const lines = [
      "# LaneLogic Jobs",
      "",
      "> LaneLogic Jobs is a search-first job board for the transportation and logistics industry.",
      "> It connects job seekers with CDL driver, warehouse, freight, and supply chain roles across the United States.",
      "",
      "## Key pages",
      "",
      `- Job search: ${canonicalHost}/`,
      `- All jobs: ${canonicalHost}/jobs`,
      `- Employer directory: ${canonicalHost}/employers`,
      `- Blog: ${canonicalHost}/blog`,
      `- Resources: ${canonicalHost}/resources`,
      `- Pricing: ${canonicalHost}/pricing`,
      `- Contact: ${canonicalHost}/contact`,
      "",
      "## About",
      "",
      "LaneLogic Jobs is the niche job board for transportation and logistics professionals.",
      "Free for job seekers. Employers can post jobs, manage applications, and promote openings.",
      "",
      "## Sitemap",
      "",
      `${canonicalHost}/sitemap.xml`,
    ];
    res.set("Content-Type", "text/plain");
    res.send(lines.join("\n"));
  });

  app.get("/:seoSlug", (req, res, next) => {
    const slug = req.params.seoSlug.toLowerCase();
    if (!slug.includes("-jobs-")) return next();
    const parts = slug.split("-jobs-");
    if (parts.length !== 2) return next();
    const [catSlug, stateSlug] = parts;
    const cat = JOB_CATEGORIES.find((c) => c.slug === catSlug);
    if (!cat || !Object.prototype.hasOwnProperty.call(SEO_STATES, stateSlug)) return next();
    res.redirect(301, `/jobs/${slug}`);
  });

  // Social Publishing endpoints
  const ZAPIER_WEBHOOK_URL = process.env.ZAPIER_SOCIAL_POST_WEBHOOK_URL;
  const ZAPIER_CALLBACK_SECRET = process.env.ZAPIER_CALLBACK_SECRET;
  const ZAPIER_PLATFORM_URLS: Record<string, string | undefined> = {
    twitter: process.env.ZAPIER_WEBHOOK_URL_TWITTER,
    facebook_page: process.env.ZAPIER_WEBHOOK_URL_FACEBOOK,
    linkedin: process.env.ZAPIER_WEBHOOK_URL_LINKEDIN,
  };
  const getPlatformWebhookUrl = (platform: string): string | undefined =>
    ZAPIER_PLATFORM_URLS[platform] || ZAPIER_WEBHOOK_URL;

  app.get("/share/jobs/:id.png", async (req, res) => {
    try {
      const jobId = Number(req.params.id);
      const job = await storage.getJob(jobId);
      if (!job) return res.status(404).json({ message: "Not found" });

      const { checkShareable } = await import("./socialHelpers");
      const shareCheck = checkShareable("job", job);
      if (!shareCheck.shareable) return res.status(404).json({ message: "Not found" });

      const variantParam = (req.query.variant as string) || "og";
      const variant = variantParam === "square" ? "square" : "og";
      const width = variant === "square" ? 1080 : 1200;
      const height = variant === "square" ? 1080 : 628;

      const { buildJobShareCard } = await import("./shareTemplates/jobShareCard");
      const { renderShareImage, getCacheKey, getJobContentHash } = await import("./utils/renderShareImage");

      const contentHash = getJobContentHash(job);
      const cacheKey = getCacheKey(jobId, contentHash, variant);
      const template = buildJobShareCard(job, variant);
      const pngBuffer = await renderShareImage(template, width, height, cacheKey);

      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(pngBuffer);
    } catch (err: any) {
      console.error("Share image error:", err);
      res.status(500).json({ message: "Failed to generate share image" });
    }
  });

  app.get("/api/admin/social-posts/webhook-status", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const anyConfigured = !!(ZAPIER_WEBHOOK_URL || Object.values(ZAPIER_PLATFORM_URLS).some(Boolean));
    res.json({
      configured: anyConfigured,
      platforms: {
        twitter: !!ZAPIER_PLATFORM_URLS.twitter,
        facebook_page: !!ZAPIER_PLATFORM_URLS.facebook_page,
        linkedin: !!ZAPIER_PLATFORM_URLS.linkedin,
      },
      fallback: !!ZAPIER_WEBHOOK_URL,
    });
  });

  app.get("/api/admin/social-posts", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const filters: { status?: string; entityType?: string } = {};
    if (typeof req.query.status === "string") filters.status = req.query.status;
    if (typeof req.query.entityType === "string") filters.entityType = req.query.entityType;
    const posts = await storage.listSocialPosts(filters);
    res.json(posts);
  });

  app.post("/api/admin/social-posts", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const { entityType, entityId, platforms, scheduledAt, copyMaster, imageUrl } = req.body;
      let entity: any;
      if (entityType === "job") entity = await storage.getJob(entityId);
      else if (entityType === "blog") entity = await storage.getBlogPost(entityId);
      else if (entityType === "resource") entity = await storage.getResource(entityId);
      else return res.status(400).json({ message: "Invalid entityType" });

      if (!entity) return res.status(404).json({ message: "Entity not found" });

      const { checkShareable } = await import("./socialHelpers");
      const shareCheck = checkShareable(entityType, entity);
      if (!shareCheck.shareable) {
        const msg = entityType === "job" && shareCheck.errors.some(e => e.reason === "expired")
          ? "Only published, non-expired jobs can be shared to social."
          : "Only published items can be shared to social.";
        return res.status(409).json({ message: msg, errors: shareCheck.errors });
      }

      const { getPublicEntityUrl } = await import("./socialHelpers");
      const { buildLinkUrl, generateDefaultCopy } = await import("../shared/socialUtils");
      const entityUrl = getPublicEntityUrl(entityType, entity);
      const linkUrl = buildLinkUrl(entityUrl);
      const titleSnapshot = entity.title;
      const defaultCopy = generateDefaultCopy(entityType, {
        title: entity.title,
        location: [entity.locationCity, entity.locationState, entity.locationCountry].filter(Boolean).join(", ") || undefined,
        salary: entity.salary || undefined,
        linkUrl,
        company: entity.companyName || undefined,
        jobType: entity.jobType || undefined,
      });

      const post = await storage.createSocialPost({
        entityType,
        entityId,
        entityUrl,
        titleSnapshot,
        imageUrl: imageUrl || null,
        linkUrl,
        platforms: platforms || ["linkedin"],
        status: "draft",
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        copyMaster: copyMaster || null,
        copyByPlatform: defaultCopy,
        provider: "zapier",
        createdBy: (req.user as any).id,
      });
      res.status(201).json(post);
    } catch (err) {
      res.status(500).json({ message: "Failed to create social post" });
    }
  });

  app.patch("/api/admin/social-posts/:id", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const post = await storage.getSocialPost(Number(req.params.id));
      if (!post) return res.status(404).json({ message: "Social post not found" });

      const { platforms, scheduledAt, copyMaster, copyByPlatform, imageUrl } = req.body;
      const updates: any = {};
      if (platforms !== undefined) {
        if (!Array.isArray(platforms) || platforms.length === 0) {
          return res.status(400).json({ message: "At least one platform is required", errors: [{ field: "platforms", reason: "empty" }] });
        }
        updates.platforms = platforms;
      }
      if (scheduledAt !== undefined) updates.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
      if (copyMaster !== undefined) updates.copyMaster = copyMaster;
      if (copyByPlatform !== undefined) updates.copyByPlatform = copyByPlatform;
      if (imageUrl !== undefined) updates.imageUrl = imageUrl;

      if (updates.copyByPlatform && updates.platforms) {
        const { validatePlatformCopy } = await import("../shared/socialUtils");
        const copyErrors = validatePlatformCopy(updates.copyByPlatform, updates.platforms);
        if (copyErrors.length > 0) {
          return res.status(400).json({ message: copyErrors.join(" "), errors: copyErrors.map(e => ({ field: "copy", reason: e })) });
        }
      }

      const updated = await storage.updateSocialPost(Number(req.params.id), updates);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update social post" });
    }
  });

  async function queueSocialPost(postId: number, req: any, res: any) {
    const post = await storage.getSocialPost(postId);
    if (!post) return res.status(404).json({ message: "Social post not found" });
    if (post.status !== "draft" && post.status !== "failed") {
      return res.status(409).json({ message: `Cannot queue a post with status "${post.status}".` });
    }

    let entity: any;
    if (post.entityType === "job") entity = await storage.getJob(post.entityId);
    else if (post.entityType === "blog") entity = await storage.getBlogPost(post.entityId);
    else if (post.entityType === "resource") entity = await storage.getResource(post.entityId);

    if (!entity) return res.status(404).json({ message: "Original entity no longer exists" });

    const { checkShareable } = await import("./socialHelpers");
    const shareCheck = checkShareable(post.entityType, entity);
    if (!shareCheck.shareable) {
      const msg = post.entityType === "job" && shareCheck.errors.some(e => e.reason === "expired")
        ? "Only published, non-expired jobs can be shared to social."
        : "Only published items can be shared to social.";
      return res.status(409).json({ message: msg, errors: shareCheck.errors });
    }

    const platforms = post.platforms as string[];
    const copyByPlatform = (post.copyByPlatform || {}) as Record<string, string>;
    const copyMaster = post.copyMaster;
    const resolvedCopy: Record<string, string> = {};
    const missingCopy: string[] = [];

    const { generateDefaultCopy, buildLinkUrl } = await import("../shared/socialUtils");
    const siteSettings = await storage.getSiteSettings();
    const siteName = (siteSettings as any).siteName || "LaneLogic Jobs";
    const { getBaseUrl } = await import("./socialHelpers");
    const baseUrl = getBaseUrl();
    const entityPath = post.entityType === "blog" ? "blog" : post.entityType === "job" ? "jobs" : "resources";
    const entityUrl = `${baseUrl}/${entityPath}/${post.entityId}`;
    const defaultCopy = generateDefaultCopy(post.entityType, {
      title: post.titleSnapshot || entity.title || "",
      location: [entity.locationCity, entity.locationState, entity.locationCountry].filter(Boolean).join(", ") || undefined,
      salary: entity.salary || undefined,
      linkUrl: buildLinkUrl(entityUrl),
      company: entity.companyName || undefined,
      jobType: entity.jobType || undefined,
    });

    for (const p of platforms) {
      if (copyByPlatform[p]) {
        resolvedCopy[p] = copyByPlatform[p];
      } else if (copyMaster) {
        resolvedCopy[p] = copyMaster;
      } else if (defaultCopy[p]) {
        resolvedCopy[p] = defaultCopy[p];
      } else {
        const { PLATFORM_LABELS } = await import("../shared/socialUtils");
        const label = PLATFORM_LABELS[p as keyof typeof PLATFORM_LABELS] || p;
        missingCopy.push(label);
      }
    }
    if (missingCopy.length > 0) {
      return res.status(400).json({
        message: `Missing copy for: ${missingCopy.join(", ")}. Provide platform-specific copy or a master copy.`,
        errors: missingCopy.map(p => ({ field: "copy", reason: `missing_${p}` })),
      });
    }

    const { validatePlatformCopy } = await import("../shared/socialUtils");
    const copyErrors = validatePlatformCopy(resolvedCopy, platforms);
    if (copyErrors.length > 0) {
      return res.status(400).json({ message: copyErrors.join(" "), errors: copyErrors.map(e => ({ field: "copy", reason: e })) });
    }

    const unconfiguredPlatforms = platforms.filter(p => !getPlatformWebhookUrl(p));
    if (unconfiguredPlatforms.length > 0) {
      await storage.updateSocialPost(postId, { status: "failed", lastError: `No webhook URL configured for: ${unconfiguredPlatforms.join(", ")}` } as any);
      return res.status(500).json({ message: `No webhook URL configured for: ${unconfiguredPlatforms.join(", ")}` });
    }

    const locationParts = [entity.locationCity, entity.locationState, entity.locationCountry].filter(Boolean);
    const location = locationParts.length > 0 ? locationParts.join(", ") : null;

    const perPlatformResults: Array<{ platform: string; success: boolean; providerRequestId: string; error?: string; response?: any }> = [];

    for (const platform of platforms) {
      const webhookUrl = getPlatformWebhookUrl(platform)!;
      const providerRequestId = `${post.entityType}-${post.entityId}-${platform}`;
      const { getJobContentHash } = await import("./utils/renderShareImage");
      const contentHash = post.entityType === "job" ? getJobContentHash(entity) : "";
      const jobImageFields = post.entityType === "job" ? {
        imageUrl: `${baseUrl}/share/jobs/${post.entityId}.png?variant=og&v=${contentHash}`,
        imageUrlOg: `${baseUrl}/share/jobs/${post.entityId}.png?variant=og&v=${contentHash}`,
        imageUrlSquare: `${baseUrl}/share/jobs/${post.entityId}.png?variant=square&v=${contentHash}`,
      } : {
        imageUrl: post.imageUrl || null,
      };
      const payload = {
        providerRequestId,
        entityType: post.entityType,
        entityId: post.entityId,
        title: post.titleSnapshot || entity.title || "",
        company: entity.companyName || null,
        location,
        locationCity: entity.locationCity || null,
        locationState: entity.locationState || null,
        locationCountry: entity.locationCountry || null,
        jobType: entity.jobType || null,
        salary: entity.salary || null,
        url: `${baseUrl}/${entityPath}/${post.entityId}`,
        ...jobImageFields,
        platform,
        copy: resolvedCopy[platform],
        scheduledAt: post.scheduledAt,
      };
      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const responseData = await response.json().catch(() => ({}));
        if (response.ok) {
          perPlatformResults.push({ platform, success: true, providerRequestId, response: responseData });
        } else {
          perPlatformResults.push({ platform, success: false, providerRequestId, error: `HTTP ${response.status}: ${JSON.stringify(responseData)}`, response: responseData });
        }
      } catch (err: any) {
        perPlatformResults.push({ platform, success: false, providerRequestId, error: err.message || "Network error" });
      }
    }

    const allSucceeded = perPlatformResults.every(r => r.success);
    const failedPlatforms = perPlatformResults.filter(r => !r.success).map(r => r.platform);
    const combinedProviderRequestId = perPlatformResults.map(r => r.providerRequestId).join(",");

    if (allSucceeded) {
      const updated = await storage.updateSocialPost(postId, {
        status: "sent",
        providerRequestId: combinedProviderRequestId,
        providerResponse: perPlatformResults,
      } as any);
      return res.json(updated);
    } else {
      await storage.updateSocialPost(postId, {
        status: "failed",
        lastError: `Failed to send to: ${failedPlatforms.join(", ")}`,
        providerRequestId: combinedProviderRequestId,
        providerResponse: perPlatformResults,
      } as any);
      return res.status(502).json({
        message: `Failed to send to: ${failedPlatforms.join(", ")}`,
        results: perPlatformResults,
      });
    }
  }

  app.post("/api/admin/social-posts/:id/queue", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    await queueSocialPost(Number(req.params.id), req, res);
  });

  app.post("/api/admin/social-posts/:id/retry", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const post = await storage.getSocialPost(Number(req.params.id));
    if (!post) return res.status(404).json({ message: "Social post not found" });
    if (post.status !== "failed") return res.status(409).json({ message: `Retry is only available for failed posts. Current status: "${post.status}".` });
    await queueSocialPost(Number(req.params.id), req, res);
  });

  app.post("/api/admin/social-posts/:id/cancel", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const post = await storage.getSocialPost(Number(req.params.id));
    if (!post) return res.status(404).json({ message: "Social post not found" });
    if (post.status !== "draft" && post.status !== "queued") {
      return res.status(409).json({ message: `Cannot cancel a post with status "${post.status}".` });
    }
    const updated = await storage.updateSocialPost(Number(req.params.id), { status: "canceled" } as any);
    res.json(updated);
  });

  app.delete("/api/admin/social-posts/:id", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const post = await storage.getSocialPost(Number(req.params.id));
    if (!post) return res.status(404).json({ message: "Social post not found" });
    if (post.status === "sent") {
      return res.status(409).json({ message: "Cannot delete a post that has already been sent." });
    }
    await storage.deleteSocialPost(Number(req.params.id));
    res.json({ message: "Post deleted" });
  });

  app.post("/api/admin/social-posts/test-webhook", async (req, res) => {
    if (!requireAdminSession(req, res)) return;

    const PLATFORM_TEST_COPY: Record<string, string> = {
      twitter: "This is a test post from LaneLogic Jobs admin. [X/Twitter]",
      facebook_page: "This is a test post from LaneLogic Jobs admin. [Facebook]",
      linkedin: "This is a test post from LaneLogic Jobs admin. [LinkedIn]",
    };

    const platformResults: Record<string, { success: boolean; status?: number; error?: string; response?: any }> = {};
    let anyConfigured = false;

    for (const platform of Object.keys(ZAPIER_PLATFORM_URLS)) {
      const url = getPlatformWebhookUrl(platform);
      if (!url) {
        platformResults[platform] = { success: false, error: "Not configured" };
        continue;
      }
      anyConfigured = true;
      try {
        const testPayload = {
          test: true,
          providerRequestId: `test-0-${platform}`,
          entityType: "test",
          entityId: 0,
          title: "Test Post",
          company: "LaneLogic Jobs",
          location: null,
          url: "https://lanelogicjobs.com/test",
          imageUrl: null,
          platform,
          copy: PLATFORM_TEST_COPY[platform] || "This is a test post from LaneLogic Jobs admin.",
          scheduledAt: null,
        };
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(testPayload),
        });
        const data = await response.json().catch(() => ({}));
        platformResults[platform] = { success: response.ok, status: response.status, response: data };
      } catch (err: any) {
        platformResults[platform] = { success: false, error: err.message || "Network error" };
      }
    }

    if (!anyConfigured) {
      return res.status(500).json({ success: false, message: "No webhook URLs configured", platforms: platformResults });
    }

    const allSucceeded = Object.values(platformResults).every(r => r.success);
    res.json({ success: allSucceeded, platforms: platformResults });
  });

  app.post("/api/integrations/zapier/social-posts/callback", async (req, res) => {
    const secret = req.headers["x-zapier-secret"];
    if (!ZAPIER_CALLBACK_SECRET || secret !== ZAPIER_CALLBACK_SECRET) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const { providerRequestId, status, providerJobId, error, response: providerResp } = req.body;
      if (!providerRequestId) return res.status(400).json({ message: "providerRequestId required" });

      const allPosts = await storage.listSocialPosts();
      const post = allPosts.find(p => p.providerRequestId === providerRequestId);
      if (!post) return res.status(409).json({ message: "No matching social post for this providerRequestId" });

      const VALID_CALLBACK_STATUSES = ["sent", "failed", "canceled"];
      if (status && !VALID_CALLBACK_STATUSES.includes(status)) {
        return res.status(400).json({ message: `Invalid status "${status}". Allowed: ${VALID_CALLBACK_STATUSES.join(", ")}` });
      }
      const updates: any = {};
      if (status) updates.status = status;
      if (providerJobId) updates.providerJobId = providerJobId;
      if (error) updates.lastError = error;
      if (providerResp) updates.providerResponse = providerResp;

      const updated = await storage.updateSocialPost(post.id, updates);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Callback processing failed" });
    }
  });

  // ── Admin Profile API ─────────────────────────────────────────────────────

  // GET /api/admin/profile — current admin's profile
  app.get("/api/admin/profile", async (req: any, res) => {
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
  app.put("/api/admin/profile", async (req: any, res) => {
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
            const { sendTemplatedEmailByEvent } = await import("./email/sendTemplatedEmail.ts");
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
  app.post("/api/admin/change-password", async (req: any, res) => {
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
  app.get("/api/admin/sessions", async (req: any, res) => {
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
  app.delete("/api/admin/sessions/:sid", async (req: any, res) => {
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
  app.get("/api/admin/system-status", async (req: any, res) => {
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
  app.get("/api/admin/notification-preferences", async (req: any, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const prefs = await storage.getNotificationPreferences(req.user.id);
      res.json(prefs);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch preferences" });
    }
  });

  // PUT /api/admin/notification-preferences
  app.put("/api/admin/notification-preferences", async (req: any, res) => {
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
  app.post("/api/admin/security-scan", async (req: any, res) => {
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
  app.get("/api/admin/admin-users", async (req: any, res) => {
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
  app.patch("/api/admin/admin-users/:id/role", async (req: any, res) => {
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
  app.post("/api/admin/invite-admin", async (req: any, res) => {
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
          const { sendTemplatedEmailByEvent } = await import("./email/sendTemplatedEmail.ts");
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

  // Seed database
  seedDatabase().catch(console.error);

  return httpServer;
}

async function seedDatabase() {
  const users = await storage.getUsers();

  const existingAdmin = await storage.getUserByEmail("steph@lanelogicjobs.com");
  if (!existingAdmin) {
    await storage.createUser({
      email: "steph@lanelogicjobs.com",
      password: "Michigan2026$",
      role: "admin",
      membershipTier: "premium",
      firstName: "Steph",
      lastName: "Admin"
    });
  }

  if (users.length === 0) {
    const admin = await storage.createUser({
      email: "admin@transportjobs.com",
      password: "password123",
      role: "admin",
      membershipTier: "premium",
      firstName: "Admin",
      lastName: "User"
    });
    
    const employer = await storage.createUser({
      email: "employer@trucking.com",
      password: "password123",
      role: "employer",
      membershipTier: "premium",
      companyName: "Fast Trucking Co."
    });

    const seeker = await storage.createUser({
      email: "seeker@example.com",
      password: "password123",
      role: "job_seeker",
      membershipTier: "basic",
      firstName: "John",
      lastName: "Driver"
    });

    await storage.createJob({
      employerId: employer.id,
      title: "Long Haul Truck Driver",
      companyName: "Fast Trucking Co.",
      jobType: "Full-time",
      description: "Looking for an experienced long haul driver. Routes across the midwest.",
      requirements: "CDL Class A, 5+ years experience",
      benefits: "Health insurance, 401k, paid time off",
      locationCity: "Chicago",
      locationState: "IL",
      locationCountry: "USA",
      salary: "$80,000 - $100,000"
    });

    await storage.createBlogPost({
      authorId: admin.id,
      title: "The Future of Transportation Jobs",
      content: "As automation increases, the role of the driver is changing..."
    });

    await storage.createResource({
      title: "Resume Tips for Truck Drivers",
      content: "Make sure to highlight your accident-free miles and certifications.",
      targetAudience: "job_seeker",
      requiredTier: "free"
    });
  }
}