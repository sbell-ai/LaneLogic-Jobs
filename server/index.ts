import crypto from "node:crypto";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { requireAdminSecret } from "./middleware/requireAdminSecret.ts";
import { adminRouter } from "./routes/admin.ts";
import { sendAlertEmail } from "./alerts/sendAlertEmail.ts";
import { syncAllRegistries } from "./registry/syncAll";
import { initEmailCronJobs } from "./cron/scheduledEmails";
import { initJobAlertCron } from "./cron/jobAlerts";

const app = express();
const httpServer = createServer(app);

const CANONICAL_HOST = process.env.CANONICAL_HOST || "";
if (CANONICAL_HOST) {
  const canonicalUrl = new URL(CANONICAL_HOST);
  app.use((req, res, next) => {
    const host = req.hostname;
    if (host === `www.${canonicalUrl.hostname}`) {
      return res.redirect(301, `${CANONICAL_HOST}${req.originalUrl}`);
    }
    next();
  });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/admin", requireAdminSecret);
app.use("/admin", adminRouter);

// Admin 404 handler (Express 5 requires named wildcards)
app.all("/admin/*path", (req, res) => {
  res.status(404).json({ ok: false, error: "Admin route not found" });
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

if (process.env.NODE_ENV === "production") {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const distPath = path.resolve(__dirname, "public");
  const indexPath = path.resolve(distPath, "index.html");

  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
  }

  app.get("/", (_req, res) => {
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(200).send("<html><body><p>Loading...</p></body></html>");
    }
  });
}

app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      const { WebhookHandlers } = await import("./webhookHandlers");
      const signature = req.headers['stripe-signature'];
      if (!signature) {
        return res.status(400).json({ error: 'Missing stripe-signature' });
      }
      const sig = Array.isArray(signature) ? signature[0] : signature;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });

  next();
});

async function startServer() {
  const port = parseInt(process.env.PORT || "5000", 10);

  try {
    await registerRoutes(httpServer, app);
  } catch (err) {
    console.error("Failed to register routes:", err);
  }

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    try {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    } catch (err) {
      console.error("Failed to setup Vite:", err);
    }
  }

  await loadTaxonomyFromDB();
  await seedDatabaseIfEmpty();
  await seedSeekerCredentials();
  await runParagraphizeMigration();
  await runResourceContentBackfill();
  await seedEmailTemplates();
  await seedEmailCronConfigs();
  httpServer.listen(
    { port, host: "0.0.0.0", reusePort: true },
    () => {
      log(`serving on port ${port}`);
    },
  );

  initStripeBackground();
  initRegistrySync();
  initImportScheduler();
  initEmailCronJobs();
  initJobAlertCron();
}

async function seedSeekerCredentials() {
  try {
    const { seedSeekerCredentialData } = await import("./routes/seekerVerification");
    await seedSeekerCredentialData();
  } catch (err) {
    console.error("Error seeding seeker credentials:", err);
  }
}

async function seedDatabaseIfEmpty() {
  try {
    const { storage } = await import("./storage");
    const existingJobs = await storage.getJobs();
    if (existingJobs.length > 1) {
      log("Database already has jobs, skipping seed");
      return;
    }
    log("Seeding database with initial data...");

    const baseDir = path.dirname(fileURLToPath(import.meta.url));
    const findSeedFile = (name: string) => {
      const candidates = [
        path.resolve(baseDir, name),
        path.resolve(baseDir, "..", "server", name),
        path.resolve("server", name),
      ];
      return candidates.find(p => fs.existsSync(p)) || null;
    };
    const seedJobsPath = findSeedFile("seed-jobs.json");
    const seedCategoriesPath = findSeedFile("seed-categories.json");

    if (seedJobsPath) {
      const jobsData = JSON.parse(fs.readFileSync(seedJobsPath, "utf-8"));
      const allUsers = await storage.getUsers();
      const adminUser = allUsers.find(u => u.role === "admin") || allUsers.find(u => u.role === "employer") || allUsers[0];
      const fallbackEmployerId = adminUser?.id || 1;
      let count = 0;
      for (const job of jobsData) {
        try {
          const employerExists = allUsers.some(u => u.id === job.employer_id);
          await storage.createJob({
            employerId: employerExists ? job.employer_id : fallbackEmployerId,
            title: job.title,
            companyName: job.company_name,
            jobType: job.job_type || "Full-time",
            category: job.category || null,
            industry: job.industry || null,
            description: job.description,
            requirements: job.requirements,
            benefits: job.benefits,
            locationCity: job.location_city,
            locationState: job.location_state,
            locationCountry: job.location_country,
            salary: job.salary,
            applyUrl: job.apply_url,
            isExternalApply: job.is_external_apply,
            expiresAt: job.expires_at ? new Date(job.expires_at) : null,
          });
          count++;
        } catch (e) {
          // skip individual job errors
        }
      }
      log(`Seeded ${count} jobs`);
    }

    if (seedCategoriesPath) {
      const catsData = JSON.parse(fs.readFileSync(seedCategoriesPath, "utf-8"));
      let count = 0;
      for (const cat of catsData) {
        try {
          await storage.createCategory({ name: cat.name, type: cat.type });
          count++;
        } catch (e) {
          // skip duplicates
        }
      }
      log(`Seeded ${count} categories`);
    }

    const seedSettingsPath = findSeedFile("seed-settings.json");
    if (seedSettingsPath) {
      const currentSettings = await storage.getSiteSettings();
      const isDefault = !currentSettings.heroHeading && !currentSettings.logoBase64;
      if (isDefault) {
        const settingsData = JSON.parse(fs.readFileSync(seedSettingsPath, "utf-8"));
        await storage.updateSiteSettings(settingsData);
        log("Seeded site settings");
      }
    }

    log("Database seeding complete");
  } catch (err) {
    console.error("Error seeding database:", err);
  }
}

async function runParagraphizeMigration() {
  try {
    const { db } = await import("./db");
    const { jobs } = await import("@shared/schema");
    const { eq, sql } = await import("drizzle-orm");

    const flagCheck = await db.execute(sql`
      SELECT settings->>'migration_paragraphize_done' as flag FROM site_settings LIMIT 1
    `);
    if (flagCheck.rows.length > 0 && flagCheck.rows[0].flag === "true") {
      return;
    }

    log("Running one-time paragraphize migration...");
    const allJobs = await db.select({ id: jobs.id, description: jobs.description }).from(jobs);
    let updated = 0;
    for (const job of allJobs) {
      if (!job.description) continue;
      const newlineCount = (job.description.match(/\n/g) || []).length;
      if (newlineCount >= 2) continue;
      const newDesc = job.description.replace(/([.?!])\s+/g, "$1\n\n");
      if (newDesc !== job.description) {
        await db.update(jobs).set({ description: newDesc }).where(eq(jobs.id, job.id));
        updated++;
      }
    }

    await db.execute(sql`
      UPDATE site_settings SET settings = settings || '{"migration_paragraphize_done": "true"}'::jsonb
    `);
    log(`Paragraphize migration complete: updated ${updated} job descriptions`);
  } catch (err) {
    console.error("Paragraphize migration error:", err);
  }
}

async function runResourceContentBackfill() {
  try {
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");

    const flagCheck = await db.execute(sql`
      SELECT settings->>'migration_resource_content_backfill_done' as flag FROM site_settings LIMIT 1
    `);
    if (flagCheck.rows.length > 0 && flagCheck.rows[0].flag === "true") {
      return;
    }

    log("Running one-time resource content backfill migration...");
    const result = await db.execute(sql`
      UPDATE resources SET intro_text = content, body_text = content, updated_at = NOW()
      WHERE (intro_text = '' OR intro_text IS NULL) AND content != '' AND content IS NOT NULL
    `);

    await db.execute(sql`
      UPDATE site_settings SET settings = settings || '{"migration_resource_content_backfill_done": true}'::jsonb
    `);
    log("Resource content backfill migration complete");
  } catch (err) {
    console.error("Resource content backfill migration error:", err);
  }
}

async function loadTaxonomyFromDB() {
  try {
    const { storage } = await import("./storage");
    const { setLiveTaxonomy } = await import("../shared/jobTaxonomy.ts");
    const settings = await storage.getSiteSettings();
    const saved = (settings as any).job_taxonomy;
    const { isLegacyTaxonomy } = await import("../shared/jobTaxonomy.ts");
    if (saved && typeof saved === "object" && !Array.isArray(saved) && Object.keys(saved).length > 0) {
      if (isLegacyTaxonomy(saved)) {
        log("[taxonomy] Ignoring legacy 2-level taxonomy from database; using new 3-level default");
      } else {
        setLiveTaxonomy(saved);
        log("[taxonomy] Loaded from database");
      }
    }
  } catch (err) {
    console.error("[taxonomy] Failed to load from database:", err);
  }
}

async function seedEmailTemplates() {
  try {
    const { DEFAULT_TEMPLATES } = await import("./email/templateSeeds.ts");
    const { storage } = await import("./storage");
    for (const t of DEFAULT_TEMPLATES) {
      const existing = await storage.getEmailTemplateBySlug(t.slug);
      if (!existing) {
        await storage.upsertEmailTemplate(t.slug, {
          slug: t.slug,
          name: t.name,
          subject: t.subject,
          body: t.body,
          variables: t.variables,
          isActive: true,
          triggerType: t.triggerType,
          triggerEvent: t.triggerEvent ?? undefined,
        });
        log(`[email] Seeded template: ${t.slug}`);
      } else if (!existing.triggerEvent && t.triggerEvent) {
        // Back-fill trigger data on existing templates that predate this feature
        await storage.upsertEmailTemplate(t.slug, {
          triggerType: t.triggerType,
          triggerEvent: t.triggerEvent,
        });
        log(`[email] Back-filled trigger for: ${t.slug}`);
      }
    }
  } catch (err) {
    console.error("[email] Failed to seed email templates:", err);
  }
}

async function seedEmailCronConfigs() {
  try {
    const { storage } = await import("./storage");
    const templates = await storage.getEmailTemplates();

    const findTemplateId = (triggerEvent: string): number | null => {
      const t = templates.find(t => t.triggerEvent === triggerEvent);
      return t ? t.id : null;
    };

    const configs: Array<{
      name: string;
      description: string;
      triggerEvent: string;
      sourceTable: string;
      triggerField: string;
      triggerOffsetDays: number;
      triggerDirection: "before" | "after";
      recipientField: string;
      recipientJoin: string | null;
      filterConditions: { field: string; operator: string; value: string }[];
      variableMappings: Record<string, string>;
    }> = [
      {
        name: "Feature Expiring — Resume Access",
        description: "Sends 7 days before a user's Resume Access feature expires.",
        triggerEvent: "feature_expiring",
        sourceTable: "users",
        triggerField: "resume_access_expires_at",
        triggerOffsetDays: 7,
        triggerDirection: "before",
        recipientField: "email",
        recipientJoin: null,
        filterConditions: [],
        variableMappings: {
          first_name: "first_name",
          expiry_date: "resume_access_expires_at",
          feature_name: "literal:Resume Access",
        },
      },
      {
        name: "Feature Expiring — Featured Employer",
        description: "Sends 7 days before a user's Featured Employer Listing feature expires.",
        triggerEvent: "feature_expiring",
        sourceTable: "users",
        triggerField: "featured_employer_expires_at",
        triggerOffsetDays: 7,
        triggerDirection: "before",
        recipientField: "email",
        recipientJoin: null,
        filterConditions: [],
        variableMappings: {
          first_name: "first_name",
          expiry_date: "featured_employer_expires_at",
          feature_name: "literal:Featured Employer Listing",
        },
      },
      {
        name: "Job Listing Expiring",
        description: "Sends 7 days before a published job listing expires.",
        triggerEvent: "job_expiring",
        sourceTable: "jobs",
        triggerField: "expires_at",
        triggerOffsetDays: 7,
        triggerDirection: "before",
        recipientField: "users.email",
        recipientJoin: "JOIN users ON jobs.employer_id = users.id",
        filterConditions: [{ field: "is_published", operator: "=", value: "true" }],
        variableMappings: {
          first_name: "first_name",
          company_name: "company_name",
          job_title: "title",
          expiry_date: "expires_at",
        },
      },
      {
        name: "Incomplete Profile Reminder",
        description: "Sends 3 days after a job seeker registers if their profile is incomplete.",
        triggerEvent: "profile_incomplete_reminder",
        sourceTable: "users",
        triggerField: "created_at",
        triggerOffsetDays: 3,
        triggerDirection: "after",
        recipientField: "email",
        recipientJoin: null,
        filterConditions: [{ field: "role", operator: "=", value: "job_seeker" }],
        variableMappings: {
          first_name: "first_name",
          missing_fields: "literal:First name, Last name, Job track / category",
        },
      },
    ];

    for (const cfg of configs) {
      const existing = await storage.getEmailCronConfigByName(cfg.name);
      if (existing) continue;

      const templateId = findTemplateId(cfg.triggerEvent);
      if (!templateId) {
        log(`[cron-seed] No template found for event "${cfg.triggerEvent}", skipping "${cfg.name}"`);
        continue;
      }

      await storage.createEmailCronConfig({
        name: cfg.name,
        description: cfg.description,
        templateId,
        sourceTable: cfg.sourceTable,
        triggerField: cfg.triggerField,
        triggerOffsetDays: cfg.triggerOffsetDays,
        triggerDirection: cfg.triggerDirection,
        recipientField: cfg.recipientField,
        recipientJoin: cfg.recipientJoin ?? undefined,
        filterConditions: cfg.filterConditions,
        variableMappings: cfg.variableMappings,
        isActive: true,
        runTime: "08:00",
      });
      log(`[cron-seed] Seeded cron config: ${cfg.name}`);
    }
  } catch (err) {
    console.error("[cron-seed] Failed to seed email cron configs:", err);
  }
}

async function initStripeBackground() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set, skipping Stripe init');
    return;
  }
  try {
    const { runMigrations } = await import('stripe-replit-sync');
    console.log('Initializing Stripe schema...');
    await runMigrations({ databaseUrl });
    console.log('Stripe schema ready');

    const { getStripeSync } = await import("./stripeClient");
    const stripeSync = await getStripeSync();

    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    await stripeSync.findOrCreateManagedWebhook(`${webhookBaseUrl}/api/stripe/webhook`);
    console.log('Stripe webhook configured');

    stripeSync.syncBackfill()
      .then(() => console.log('Stripe data synced'))
      .catch((err: any) => console.error('Stripe backfill error:', err));
  } catch (error) {
    console.error('Failed to initialize Stripe:', error);
  }
}

const SYNC_INTERVAL_MS = 15 * 60 * 1000;

async function initRegistrySync() {
  const environment = process.env.REPLIT_DOMAINS ? "prod" : "staging";
  try {
    console.log("[registry-sync] Running initial sync...");
    const result = await syncAllRegistries({ environment });
    console.log("[registry-sync] Initial sync result:", JSON.stringify(result));
  } catch (err) {
    console.error("[registry-sync] Initial sync error:", err);
  }

  setInterval(async () => {
    try {
      const result = await syncAllRegistries({ environment });
      if (!result.ok) {
        console.warn("[registry-sync] Periodic sync had issues:", result);
      }
    } catch (err) {
      console.error("[registry-sync] Periodic sync error:", err);
    }
  }, SYNC_INTERVAL_MS);
}

const IMPORT_SCHEDULER_INTERVAL_MS = 15 * 60 * 1000;

async function seedDefaultJobSource() {
  try {
    const { storage } = await import("./storage");
    const sources = await storage.getJobSources();
    if (sources.length > 0) {
      console.log("[import-scheduler] Job sources already exist, skipping seed");
      return;
    }
    await storage.createJobSource({
      name: "Apify Workday Scraper",
      type: "apify",
      actorId: "apify/workday-scraper",
      actorInputJson: {
        searchTerms: ["driver", "logistics", "transportation", "warehouse", "freight", "supply chain", "trucking", "CDL"],
        maxResults: 5000,
      },
      pollIntervalMinutes: 720,
      status: "paused",
    });
    console.log("[import-scheduler] Seeded default job source (paused)");
  } catch (err) {
    console.error("[import-scheduler] Seed error:", err);
  }
}

async function initImportScheduler() {
  await seedDefaultJobSource();

  setInterval(async () => {
    try {
      const { storage } = await import("./storage");
      const dueSources = await storage.getActiveJobSourcesDueForPoll();
      if (dueSources.length === 0) return;

      for (const source of dueSources) {
        const claimed = await storage.claimJobSourceForRun(source.id);
        if (!claimed) continue;

        console.log(`[import-scheduler] Starting import for source ${source.id} (${source.name})`);
        const { runImport } = await import("./import/importOrchestrator");
        runImport(source).catch(err => {
          console.error(`[import-scheduler] Import error for source ${source.id}:`, err);
        });
      }
    } catch (err) {
      console.error("[import-scheduler] Scheduler error:", err);
    }
  }, IMPORT_SCHEDULER_INTERVAL_MS);
}

startServer().catch((err) => {
  console.error("Fatal server error:", err);
  process.exit(1);
});
