import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { insertPageSchema } from "@shared/schema";
import { z } from "zod";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import { getPricingData, resolveUserEntitlements, checkEntitlement } from "./registry/entitlementResolver";

const uploadStorage = multer.diskStorage({
  destination: path.join(process.cwd(), "uploads"),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});
const upload = multer({
  storage: uploadStorage,
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
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
  app.post(api.auth.login.path, passport.authenticate('local'), (req, res) => {
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

  app.get(api.auth.me.path, (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  // Users
  app.get(api.users.list.path, async (req, res) => {
    const users = await storage.getUsers();
    res.json(users);
  });

  // Admin: create a user directly (invite)
  app.post("/api/admin/users", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
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
    try {
      const input = api.users.update.input.parse(req.body);
      const user = await storage.updateUser(Number(req.params.id), input);
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

  // Jobs
  app.get(api.jobs.list.path, async (req, res) => {
    const allJobs = await storage.getJobs();
    const allUsers = await storage.getUsers();
    const employerMap = new Map(allUsers.filter(u => u.role === "employer").map(u => [u.id, u]));
    const enriched = allJobs.map(job => ({
      ...job,
      employerLogo: employerMap.get(job.employerId)?.companyLogo || null,
    }));
    res.json(enriched);
  });

  app.get(api.jobs.get.path, async (req, res) => {
    const job = await storage.getJob(Number(req.params.id));
    if (!job) return res.status(404).json({ message: "Not found" });
    const employer = await storage.getUser(job.employerId);
    res.json({ ...job, employerLogo: employer?.companyLogo || null });
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
      const input = api.jobs.create.input.parse(body);
      const job = await storage.createJob(input);
      res.status(201).json(job);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put(api.jobs.update.path, async (req, res) => {
    try {
      const body = { ...req.body };
      if (body.expiresAt && typeof body.expiresAt === "string") body.expiresAt = new Date(body.expiresAt);
      if (body.expiresAt === null || body.expiresAt === "") body.expiresAt = null;
      const input = api.jobs.update.input.parse(body);
      const job = await storage.updateJob(Number(req.params.id), input);
      res.json(job);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete(api.jobs.delete.path, async (req, res) => {
    await storage.deleteJob(Number(req.params.id));
    res.status(204).end();
  });

  app.put("/api/jobs-bulk-update", async (req, res) => {
    try {
      const { ids, updates } = req.body as { ids: number[]; updates: Record<string, any> };
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "No job IDs provided" });
      const allowed = ["jobType", "category", "industry"];
      const filtered: Record<string, any> = {};
      for (const key of allowed) {
        if (key in updates) filtered[key] = updates[key];
      }
      if (Object.keys(filtered).length === 0) return res.status(400).json({ message: "No valid fields to update" });
      const results = await Promise.all(ids.map(id => storage.updateJob(id, filtered)));
      res.json({ updated: results.length });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Applications
  app.get(api.applications.list.path, async (req, res) => {
    const apps = await storage.getApplications();
    res.json(apps);
  });

  app.post(api.applications.create.path, async (req, res) => {
    try {
      if (req.isAuthenticated()) {
        const user = req.user as any;
        if (user.role === "job_seeker") {
          const ent = await checkEntitlement(user, "applications_per_month");
          if (!ent.allowed) {
            return res.status(403).json({ message: "You have reached your application limit for this month. Please upgrade your plan." });
          }
        }
      }
      const input = api.applications.create.input.parse(req.body);
      const appData = await storage.createApplication(input);
      res.status(201).json(appData);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put(api.applications.update.path, async (req, res) => {
    try {
      const input = api.applications.update.input.parse(req.body);
      const appData = await storage.updateApplication(Number(req.params.id), input);
      res.json(appData);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Resources
  app.get(api.resources.list.path, async (req, res) => {
    const resources = await storage.getResources();
    res.json(resources);
  });

  app.post(api.resources.create.path, async (req, res) => {
    try {
      const input = api.resources.create.input.parse(req.body);
      const resource = await storage.createResource(input);
      res.status(201).json(resource);
    } catch (err) {
      res.status(400).json({ message: "Validation error" });
    }
  });

  // Blog
  app.get(api.blog.list.path, async (req, res) => {
    const posts = await storage.getBlogPosts();
    res.json(posts);
  });

  app.get(api.blog.get.path, async (req, res) => {
    const post = await storage.getBlogPost(Number(req.params.id));
    if (!post) return res.status(404).json({ message: "Not found" });
    res.json(post);
  });

  app.post(api.blog.create.path, async (req, res) => {
    try {
      const input = api.blog.create.input.parse(req.body);
      const post = await storage.createBlogPost(input);
      res.status(201).json(post);
    } catch (err) {
      res.status(400).json({ message: "Validation error" });
    }
  });

  // Resumes
  app.get(api.resumes.get.path, async (req, res) => {
    const userResumes = await storage.getResumes(Number(req.params.jobSeekerId));
    res.json(userResumes);
  });

  app.post(api.resumes.create.path, async (req, res) => {
    try {
      const input = api.resumes.create.input.parse(req.body);
      const resume = await storage.createResume(input);
      res.status(201).json(resume);
    } catch (err) {
      res.status(400).json({ message: "Validation error" });
    }
  });

  // Resource update/delete
  app.put("/api/resources/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const resource = await storage.updateResource(Number(req.params.id), req.body);
      res.json(resource);
    } catch (err) {
      res.status(400).json({ message: "Update failed" });
    }
  });

  app.delete("/api/resources/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.deleteResource(Number(req.params.id));
    res.json({ message: "Deleted" });
  });

  // Blog update/delete
  app.put("/api/blog/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const post = await storage.updateBlogPost(Number(req.params.id), req.body);
      res.json(post);
    } catch (err) {
      res.status(400).json({ message: "Update failed" });
    }
  });

  app.delete("/api/blog/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.deleteBlogPost(Number(req.params.id));
    res.json({ message: "Deleted" });
  });

  // User delete
  app.delete("/api/users/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.deleteUser(Number(req.params.id));
    res.json({ message: "Deleted" });
  });

  // Categories
  app.get("/api/categories", async (_req, res) => {
    const cats = await storage.getCategories();
    res.json(cats);
  });

  app.post("/api/categories", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const cat = await storage.createCategory(req.body);
      res.status(201).json(cat);
    } catch (err) {
      res.status(400).json({ message: "Validation error" });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.deleteCategory(Number(req.params.id));
    res.json({ message: "Deleted" });
  });

  // Coupons
  app.get("/api/coupons", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    const allCoupons = await storage.getCoupons();
    res.json(allCoupons);
  });

  app.post("/api/coupons", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const coupon = await storage.createCoupon(req.body);
      res.status(201).json(coupon);
    } catch (err) {
      res.status(400).json({ message: "Validation error" });
    }
  });

  app.put("/api/coupons/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const coupon = await storage.updateCoupon(Number(req.params.id), req.body);
      res.json(coupon);
    } catch (err) {
      res.status(400).json({ message: "Update failed" });
    }
  });

  app.delete("/api/coupons/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
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
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
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
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
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
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.deletePage(Number(req.params.id));
    res.json({ message: "Deleted" });
  });

  app.post(api.uploads.csv.path, (req, res) => {
    res.json({ message: "CSV uploaded successfully", count: 10 });
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
        const productName = `TranspoJobs ${tierLabel} - ${roleLabel}`;
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

      if (session.payment_status !== "paid") {
        return res.status(400).json({ message: "Payment not completed" });
      }

      const userId = parseInt(session.metadata?.userId || "0", 10);
      const user = req.user as any;
      if (userId !== user.id) {
        return res.status(403).json({ message: "Session does not belong to this user" });
      }

      const planType = session.metadata?.planType;
      if (planType !== "Top-up") {
        return res.status(400).json({ message: "Not a top-up purchase" });
      }

      const pricingData = await getPricingData();
      const paidPriceId = session.metadata?.stripePriceId;
      if (!pricingData || !paidPriceId) {
        return res.status(400).json({ message: "Cannot resolve product" });
      }

      const product = pricingData.products.find((p) => p.stripePriceId === paidPriceId);
      if (!product) {
        return res.status(400).json({ message: "Product not found" });
      }

      const now = new Date();
      const productNameLower = product.name.toLowerCase();

      if (productNameLower.includes("resume")) {
        const currentExpiry = user.resumeAccessExpiresAt ? new Date(user.resumeAccessExpiresAt) : null;
        const baseDate = currentExpiry && currentExpiry > now ? currentExpiry : now;
        const newExpiry = new Date(baseDate.getTime() + 365 * 24 * 60 * 60 * 1000);
        await storage.updateUser(user.id, { resumeAccessExpiresAt: newExpiry } as any);
        fulfilledSessions.add(sessionId);
        return res.json({ message: "Resume Access activated", expiresAt: newExpiry.toISOString() });
      }

      if (productNameLower.includes("featured")) {
        const currentExpiry = user.featuredEmployerExpiresAt ? new Date(user.featuredEmployerExpiresAt) : null;
        const baseDate = currentExpiry && currentExpiry > now ? currentExpiry : now;
        const newExpiry = new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        await storage.updateUser(user.id, { featuredEmployerExpiresAt: newExpiry } as any);
        fulfilledSessions.add(sessionId);
        return res.json({ message: "Featured Employer activated", expiresAt: newExpiry.toISOString() });
      }

      return res.status(400).json({ message: "Unknown add-on type" });
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
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const settings = await storage.updateSiteSettings(req.body);
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
  }, upload.single("file"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const url = `/uploads/${req.file.filename}`;
    res.json({ url });
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