import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { isR2Configured } from "./r2";
import { JOB_CATEGORIES, US_STATES as SEO_STATES } from "@shared/seoConfig";

import authRouter from "./routes/auth";
import adminRegistryRouter from "./routes/adminRegistry";
import usersRouter from "./routes/users";
import employersRouter from "./routes/employers";
import jobsRouter from "./routes/jobs";
import applicationsRouter from "./routes/applications";
import jobAlertsRouter from "./routes/jobAlerts";
import resourcesRouter from "./routes/resources";
import blogRouter from "./routes/blog";
import seekersRouter from "./routes/seekers";
import categoriesRouter from "./routes/categories";
import couponsRouter from "./routes/coupons";
import cmsRouter from "./routes/cms";
import importsRouter from "./routes/imports";
import uploadsRouter from "./routes/uploads";
import taxonomyRouter from "./routes/taxonomy";
import emailTemplatesRouter from "./routes/emailTemplates";
import emailCronRouter from "./routes/emailCron";
import migrationsRouter from "./routes/migrations";
import paymentsRouter from "./routes/payments";
import siteSettingsRouter from "./routes/siteSettings";
import profileRouter from "./routes/profile";
import contactRouter from "./routes/contact";
import messagingRouter from "./routes/messaging";
import seoRouter from "./routes/seo";
import socialRouter from "./routes/social";
import adminProfileRouter from "./routes/adminProfile";

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

  // Mount domain-specific sub-routers
  app.use(authRouter);

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

  app.use(adminRegistryRouter);
  app.use(usersRouter);
  app.use(employersRouter);
  app.use(jobsRouter);
  app.use(applicationsRouter);
  app.use(jobAlertsRouter);
  app.use(resourcesRouter);
  app.use(blogRouter);
  app.use(seekersRouter);
  app.use(categoriesRouter);
  app.use(couponsRouter);
  app.use(cmsRouter);
  app.use(importsRouter);
  app.use(uploadsRouter);
  app.use(taxonomyRouter);
  app.use(emailTemplatesRouter);
  app.use(emailCronRouter);
  app.use(migrationsRouter);
  app.use(paymentsRouter);
  app.use(siteSettingsRouter);
  app.use(profileRouter);
  app.use(contactRouter);
  app.use(messagingRouter);
  app.use(seoRouter);
  app.use(socialRouter);
  app.use(adminProfileRouter);

  // /:seoSlug catch-all — must be registered LAST (matches single-segment paths
  // like /drivers-jobs-tx and redirects to /jobs/<slug>; falls through to next()
  // when the slug doesn't match a known category+state pair).
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
    } as any);

    await storage.createResource({
      title: "Resume Tips for Truck Drivers",
      content: "Make sure to highlight your accident-free miles and certifications.",
      targetAudience: "job_seeker",
      requiredTier: "free"
    });
  }
}
