import { pgTable, text, serial, integer, boolean, timestamp, jsonb, uniqueIndex, real, index } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("job_seeker"), // admin, employer, job_seeker
  membershipTier: text("membership_tier").notNull().default("free"), // free, basic, premium
  firstName: text("first_name"),
  lastName: text("last_name"),
  companyName: text("company_name"),
  companyAddress: text("company_address"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  aboutCompany: text("about_company"),
  profileImage: text("profile_image"),
  companyLogo: text("company_logo"),
  showProfile: boolean("show_profile").notNull().default(true),
  showName: boolean("show_name").notNull().default(true),
  showCurrentEmployer: boolean("show_current_employer").notNull().default(true),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  resumeAccessExpiresAt: timestamp("resume_access_expires_at"),
  featuredEmployerExpiresAt: timestamp("featured_employer_expires_at"),
  notionEmployerUrl: text("notion_employer_url"),
  employerCategory: text("employer_category"),
  verificationStatus: text("verification_status").notNull().default("unverified"),
  seekerTrack: text("seeker_track").default("Unknown"),
  seekerVerificationStatus: text("seeker_verification_status").notNull().default("unverified"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  employerId: integer("employer_id").notNull(),
  externalJobKey: text("external_job_key"),
  title: text("title").notNull(),
  companyName: text("company_name"),
  jobType: text("job_type"),
  category: text("category"),
  subcategory: text("subcategory"),
  industry: text("industry"),
  description: text("description").notNull(),
  requirements: text("requirements").notNull(),
  benefits: text("benefits"),
  locationCity: text("location_city"),
  locationState: text("location_state"),
  locationCountry: text("location_country"),
  salary: text("salary"),
  applyUrl: text("apply_url"),
  isExternalApply: boolean("is_external_apply").default(false),
  jobMetadata: jsonb("job_metadata"),
  isPublished: boolean("is_published").notNull().default(false),
  publishedAt: timestamp("published_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  sourceId: integer("source_id"),
  importTargetId: integer("import_target_id"),
  externalJobId: text("external_job_id"),
  sourceUrl: text("source_url"),
  externalPostedAt: timestamp("external_posted_at"),
  externalCreatedAt: timestamp("external_created_at"),
  externalValidThrough: timestamp("external_valid_through"),
  employmentType: text("employment_type"),
  isRemote: boolean("is_remote"),
  workLocationType: text("work_location_type"),
  tags: text("tags").array(),
  status: text("status").notNull().default("active"),
  importedAt: timestamp("imported_at"),
  lastImportedAt: timestamp("last_imported_at"),
  lastAdminEditedAt: timestamp("last_admin_edited_at"),
  rawSourceSnippet: text("raw_source_snippet"),
}, (table) => [
  uniqueIndex("jobs_employer_external_key_idx")
    .on(table.employerId, table.externalJobKey)
    .where(sql`${table.externalJobKey} IS NOT NULL`),
  uniqueIndex("jobs_source_target_external_idx")
    .on(table.sourceId, table.importTargetId, table.externalJobId)
    .where(sql`${table.sourceId} IS NOT NULL AND ${table.externalJobId} IS NOT NULL`),
]);

export const applications = pgTable("applications", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  jobSeekerId: integer("job_seeker_id").notNull(),
  resumeUrl: text("resume_url"),
  status: text("status").notNull().default("pending"), // pending, reviewed, accepted, rejected
  createdAt: timestamp("created_at").defaultNow(),
});

export const resources = pgTable("resources", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content").notNull().default(""),
  introText: text("intro_text").notNull().default(""),
  bodyText: text("body_text").notNull().default(""),
  targetAudience: text("target_audience").notNull(), // employer, job_seeker, both
  requiredTier: text("required_tier").notNull().default("free"),
  isPublished: boolean("is_published").notNull().default(false),
  publishedAt: timestamp("published_at"),
  pageId: integer("page_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category"),
  isPublished: boolean("is_published").notNull().default(false),
  publishedAt: timestamp("published_at").defaultNow(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  discountType: text("discount_type").notNull(),
  discountValue: integer("discount_value").notNull(),
  maxUses: integer("max_uses"),
  currentUses: integer("current_uses").notNull().default(0),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  appliesTo: text("applies_to").notNull().default("all"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const resumes = pgTable("resumes", {
  id: serial("id").primaryKey(),
  jobSeekerId: integer("job_seeker_id").notNull(),
  content: text("content").notNull(), // text-based resume or file URL
  isUpload: boolean("is_upload").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// connect-pg-simple session store table
// This table is expected by connect-pg-simple when you use it with express-session.
// Do NOT rename it unless you also change connect-pg-simple's tableName config.
export const session = pgTable("session", {
  sid: text("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

// ---- Registry sync snapshots (source-of-truth for runtime config) ----
export const registrySnapshots = pgTable("registry_snapshots", {
        id: serial("id").primaryKey(),
        // e.g. "prod" | "staging"
        environment: text("environment").notNull(),
        // e.g. "design_system_security" | "pricing_compliance"
        registryName: text("registry_name").notNull(),
        // Hash of normalized payload (dedupe/change detection)
        contentHash: text("content_hash").notNull(),
        // What the app reads at runtime (normalized config recommended)
        payload: jsonb("payload").notNull(),
        // Optional: list of Notion row URLs included (audit/debug)
        rowUrls: jsonb("row_urls").notNull(), // string[]
        // Validation summary
        validRowCount: integer("valid_row_count").notNull().default(0),
        invalidRowCount: integer("invalid_row_count").notNull().default(0),
        // Precedence flags
        isLastKnownGood: boolean("is_last_known_good").notNull().default(false),
        isActive: boolean("is_active").notNull().default(false),
        createdAt: timestamp("created_at").defaultNow(),
});

// ---- Registry events (audit log + alert source) ----
export const registryEvents = pgTable("registry_events", {
        id: serial("id").primaryKey(),

        environment: text("environment").notNull(),
        registryName: text("registry_name").notNull(),
        // e.g. "registry.validation_failed" | "registry.fallback_to_lkg" | "registry.no_lkg"
        eventType: text("event_type").notNull(),
        // "SEV-1" | "SEV-2" | "SEV-3"
        severity: text("severity").notNull(),
        // Stable identifier like "VAL-PLANS-STRIPE_PRODUCT_ID_REQUIRED"
        validationRuleId: text("validation_rule_id"),
        rowUrl: text("row_url"),
        reason: text("reason"),
        activeSnapshotId: integer("active_snapshot_id"),
        lastKnownGoodSnapshotId: integer("last_known_good_snapshot_id"),
        // Any extra structured info (counts, hashes, etc.)
        details: jsonb("details").notNull().default({}),
        createdAt: timestamp("created_at").defaultNow(),
});

export const pages = pgTable("pages", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content").notNull().default(""),
  seoTitle: text("seo_title"),
  metaDescription: text("meta_description"),
  isPublished: boolean("is_published").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const jobSources = pgTable("job_sources", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().default("apify"),
  name: text("name").notNull(),
  actorId: text("actor_id").notNull(),
  actorInputJson: jsonb("actor_input_json").notNull(),
  pollIntervalMinutes: integer("poll_interval_minutes").notNull().default(360),
  status: text("status").notNull().default("active"),
  lastRunAt: timestamp("last_run_at"),
  lastSuccessfulRunAt: timestamp("last_successful_run_at"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const importTargets = pgTable("import_targets", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").notNull(),
  sourceDomain: text("source_domain").notNull(),
  companyName: text("company_name").notNull(),
  employerWebsiteDomain: text("employer_website_domain"),
  status: text("status").notNull().default("pending_review"),
  firstSeenAt: timestamp("first_seen_at").defaultNow(),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
}, (table) => [
  uniqueIndex("import_targets_source_domain_idx").on(table.sourceId, table.sourceDomain),
]);

export const jobImportRuns = pgTable("job_import_runs", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").notNull(),
  status: text("status").notNull().default("queued"),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  apifyRunId: text("apify_run_id"),
  apifyDatasetId: text("apify_dataset_id"),
  actorInputJson: jsonb("actor_input_json"),
  statsCreated: integer("stats_created").notNull().default(0),
  statsUpdated: integer("stats_updated").notNull().default(0),
  statsSkipped: integer("stats_skipped").notNull().default(0),
  statsExpired: integer("stats_expired").notNull().default(0),
  warnings: jsonb("warnings"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const importRuns = pgTable("import_runs", {
  id: serial("id").primaryKey(),
  employerId: integer("employer_id").notNull(),
  uploadedBy: integer("uploaded_by").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  filename: text("filename"),
  fileHash: text("file_hash"),
  rowsTotal: integer("rows_total").default(0),
  rowsImported: integer("rows_imported").default(0),
  rowsSkipped: integer("rows_skipped").default(0),
  status: text("status").notNull().default("Processing"),
});

export const importArtifacts = pgTable("import_artifacts", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type"),
  data: text("data").notNull(),
});

export const socialPosts = pgTable("social_posts", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  entityUrl: text("entity_url").notNull(),
  titleSnapshot: text("title_snapshot").notNull(),
  imageUrl: text("image_url"),
  linkUrl: text("link_url").notNull(),
  platforms: jsonb("platforms").notNull().$type<string[]>(),
  status: text("status").notNull().default("draft"),
  scheduledAt: timestamp("scheduled_at"),
  copyMaster: text("copy_master"),
  copyByPlatform: jsonb("copy_by_platform").$type<Record<string, string>>(),
  provider: text("provider").notNull().default("zapier"),
  providerRequestId: text("provider_request_id"),
  providerJobId: text("provider_job_id"),
  providerResponse: jsonb("provider_response"),
  lastError: text("last_error"),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ---- Admin Product Management (replaces Notion SOT) ----
export const adminProducts = pgTable("admin_products", {
  id: serial("id").primaryKey(),
  notionPageId: text("notion_page_id"),
  name: text("name").notNull(),
  audience: text("audience").notNull(), // employer | job_seeker
  kind: text("kind").notNull(), // base_plan | add_on
  billingType: text("billing_type").notNull(), // subscription | one_time
  priceMonthly: real("price_monthly"),
  priceYearly: real("price_yearly"),
  priceOneTime: real("price_one_time"),
  stripeProductId: text("stripe_product_id"),
  stripePriceIdMonthly: text("stripe_price_id_monthly"),
  stripePriceIdYearly: text("stripe_price_id_yearly"),
  stripePriceIdOneTime: text("stripe_price_id_one_time"),
  logicKey: text("logic_key"),
  trialDays: integer("trial_days").notNull().default(0),
  status: text("status").notNull().default("Active"), // Active | Inactive
  planType: text("plan_type").notNull().default("Subscription"), // Subscription | Top-up | Admin/Flag
  quotaSource: text("quota_source"),
  activeInstruction: text("active_instruction"),
  grantEntitlementKey: text("grant_entitlement_key"),
  grantAmount: integer("grant_amount"),
  creditExpiryMonths: integer("credit_expiry_months").default(12),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("admin_products_notion_page_id_idx").on(table.notionPageId).where(sql`${table.notionPageId} IS NOT NULL`),
]);

export const adminEntitlements = pgTable("admin_entitlements", {
  id: serial("id").primaryKey(),
  notionPageId: text("notion_page_id"),
  name: text("name").notNull(),
  key: text("key").notNull().unique(),
  type: text("type").notNull(), // Limit | Flag
  unit: text("unit"),
  defaultValue: text("default_value"),
  status: text("status").notNull().default("Active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("admin_entitlements_notion_page_id_idx").on(table.notionPageId).where(sql`${table.notionPageId} IS NOT NULL`),
]);

export const adminProductOverrides = pgTable("admin_product_overrides", {
  id: serial("id").primaryKey(),
  notionPageId: text("notion_page_id"),
  productId: integer("product_id").notNull(),
  entitlementId: integer("entitlement_id").notNull(),
  value: real("value"),
  isUnlimited: boolean("is_unlimited").notNull().default(false),
  enabled: boolean("enabled").notNull().default(false),
  status: text("status").notNull().default("Active"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("admin_product_overrides_product_entitlement_idx").on(table.productId, table.entitlementId),
  uniqueIndex("admin_product_overrides_notion_page_id_idx").on(table.notionPageId).where(sql`${table.notionPageId} IS NOT NULL`),
]);

export const adminProductEntitlements = pgTable("admin_product_entitlements", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  entitlementId: integer("entitlement_id").notNull(),
}, (table) => [
  uniqueIndex("admin_product_entitlements_product_entitlement_idx").on(table.productId, table.entitlementId),
]);

export const migrationState = pgTable("migration_state", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  completedAt: timestamp("completed_at"),
  result: jsonb("result"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const entitlementUsageWindows = pgTable("entitlement_usage_windows", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  entitlementKey: text("entitlement_key").notNull(),
  windowStart: timestamp("window_start").notNull(),
  windowEnd: timestamp("window_end").notNull(),
  usedCount: integer("used_count").notNull().default(0),
}, (table) => [
  uniqueIndex("entitlement_usage_windows_user_key_start_idx").on(table.userId, table.entitlementKey, table.windowStart),
]);

export const entitlementCreditGrants = pgTable("entitlement_credit_grants", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  entitlementKey: text("entitlement_key").notNull(),
  amountGranted: integer("amount_granted").notNull(),
  amountRemaining: integer("amount_remaining").notNull(),
  grantedAt: timestamp("granted_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  status: text("status").notNull().default("Active"),
});

export const entitlementCreditConsumptions = pgTable("entitlement_credit_consumptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  entitlementKey: text("entitlement_key").notNull(),
  grantId: integer("grant_id").notNull(),
  amount: integer("amount").notNull().default(1),
  consumedAt: timestamp("consumed_at").notNull().defaultNow(),
  sourceEvent: text("source_event"),
  refId: integer("ref_id"),
});

export const employerVerificationRequests = pgTable("employer_verification_requests", {
  id: serial("id").primaryKey(),
  employerId: integer("employer_id").notNull(),
  status: text("status").notNull().default("draft"),
  adminNotes: text("admin_notes"),
  decidedBy: integer("decided_by"),
  decidedAt: timestamp("decided_at"),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("evr_employer_active_idx")
    .on(table.employerId)
    .where(sql`${table.status} IN ('draft', 'submitted', 'needs_more')`),
  index("evr_status_idx").on(table.status),
]);

export const employerEvidenceItems = pgTable("employer_evidence_items", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull(),
  sourceType: text("source_type").notNull(),
  sourceUrl: text("source_url"),
  excerpt: text("excerpt"),
  claim: text("claim"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("eei_request_idx").on(table.requestId),
]);

export const insertEmployerVerificationRequestSchema = createInsertSchema(employerVerificationRequests).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEmployerEvidenceItemSchema = createInsertSchema(employerEvidenceItems).omit({ id: true, createdAt: true });

export const seekerCredentialRequirements = pgTable("seeker_credential_requirements", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  description: text("description"),
  category: text("category").notNull().default("license"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const seekerRequirementRules = pgTable("seeker_requirement_rules", {
  id: serial("id").primaryKey(),
  requirementKey: text("requirement_key").notNull(),
  conditionType: text("condition_type").notNull(),
  conditionValue: text("condition_value").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const seekerVerificationRequests = pgTable("seeker_verification_requests", {
  id: serial("id").primaryKey(),
  seekerId: integer("seeker_id").notNull(),
  status: text("status").notNull().default("draft"),
  requirementsSnapshot: text("requirements_snapshot").array(),
  adminNotes: text("admin_notes"),
  decidedBy: integer("decided_by"),
  decidedAt: timestamp("decided_at"),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("svr_seeker_active_idx")
    .on(table.seekerId)
    .where(sql`${table.status} IN ('draft', 'submitted', 'needs_more')`),
  index("svr_status_idx").on(table.status),
]);

export const seekerCredentialEvidenceItems = pgTable("seeker_credential_evidence_items", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull(),
  requirementKey: text("requirement_key").notNull(),
  sourceType: text("source_type").notNull(),
  sourceUrl: text("source_url"),
  excerpt: text("excerpt"),
  claim: text("claim"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("scei_request_idx").on(table.requestId),
]);

export const insertSeekerCredentialRequirementSchema = createInsertSchema(seekerCredentialRequirements).omit({ id: true, createdAt: true });
export const insertSeekerRequirementRuleSchema = createInsertSchema(seekerRequirementRules).omit({ id: true, createdAt: true });
export const insertSeekerVerificationRequestSchema = createInsertSchema(seekerVerificationRequests).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSeekerCredentialEvidenceItemSchema = createInsertSchema(seekerCredentialEvidenceItems).omit({ id: true, createdAt: true });

export type EmployerVerificationRequest = typeof employerVerificationRequests.$inferSelect;
export type InsertEmployerVerificationRequest = z.infer<typeof insertEmployerVerificationRequestSchema>;
export type EmployerEvidenceItem = typeof employerEvidenceItems.$inferSelect;
export type InsertEmployerEvidenceItem = z.infer<typeof insertEmployerEvidenceItemSchema>;

export type SeekerCredentialRequirement = typeof seekerCredentialRequirements.$inferSelect;
export type InsertSeekerCredentialRequirement = z.infer<typeof insertSeekerCredentialRequirementSchema>;
export type SeekerRequirementRule = typeof seekerRequirementRules.$inferSelect;
export type InsertSeekerRequirementRule = z.infer<typeof insertSeekerRequirementRuleSchema>;
export type SeekerVerificationRequest = typeof seekerVerificationRequests.$inferSelect;
export type InsertSeekerVerificationRequest = z.infer<typeof insertSeekerVerificationRequestSchema>;
export type SeekerCredentialEvidenceItem = typeof seekerCredentialEvidenceItems.$inferSelect;
export type InsertSeekerCredentialEvidenceItem = z.infer<typeof insertSeekerCredentialEvidenceItemSchema>;

export const insertEntitlementUsageWindowSchema = createInsertSchema(entitlementUsageWindows).omit({ id: true });
export const insertEntitlementCreditGrantSchema = createInsertSchema(entitlementCreditGrants).omit({ id: true });
export const insertEntitlementCreditConsumptionSchema = createInsertSchema(entitlementCreditConsumptions).omit({ id: true });

export type EntitlementUsageWindow = typeof entitlementUsageWindows.$inferSelect;
export type InsertEntitlementUsageWindow = z.infer<typeof insertEntitlementUsageWindowSchema>;
export type EntitlementCreditGrant = typeof entitlementCreditGrants.$inferSelect;
export type InsertEntitlementCreditGrant = z.infer<typeof insertEntitlementCreditGrantSchema>;
export type EntitlementCreditConsumption = typeof entitlementCreditConsumptions.$inferSelect;
export type InsertEntitlementCreditConsumption = z.infer<typeof insertEntitlementCreditConsumptionSchema>;

export const insertJobSourceSchema = createInsertSchema(jobSources).omit({ id: true, createdAt: true, updatedAt: true });
export const insertImportTargetSchema = createInsertSchema(importTargets).omit({ id: true });
export const insertJobImportRunSchema = createInsertSchema(jobImportRuns).omit({ id: true, createdAt: true });

export type JobSource = typeof jobSources.$inferSelect;
export type InsertJobSource = z.infer<typeof insertJobSourceSchema>;
export type ImportTarget = typeof importTargets.$inferSelect;
export type InsertImportTarget = z.infer<typeof insertImportTargetSchema>;
export type JobImportRun = typeof jobImportRuns.$inferSelect;
export type InsertJobImportRun = z.infer<typeof insertJobImportRunSchema>;

export const insertAdminProductSchema = createInsertSchema(adminProducts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAdminEntitlementSchema = createInsertSchema(adminEntitlements).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAdminProductOverrideSchema = createInsertSchema(adminProductOverrides).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAdminProductEntitlementSchema = createInsertSchema(adminProductEntitlements).omit({ id: true });
export const insertMigrationStateSchema = createInsertSchema(migrationState).omit({ id: true, createdAt: true });

export type AdminProduct = typeof adminProducts.$inferSelect;
export type InsertAdminProduct = z.infer<typeof insertAdminProductSchema>;
export type AdminEntitlement = typeof adminEntitlements.$inferSelect;
export type InsertAdminEntitlement = z.infer<typeof insertAdminEntitlementSchema>;
export type AdminProductOverride = typeof adminProductOverrides.$inferSelect;
export type InsertAdminProductOverride = z.infer<typeof insertAdminProductOverrideSchema>;
export type AdminProductEntitlement = typeof adminProductEntitlements.$inferSelect;
export type InsertAdminProductEntitlement = z.infer<typeof insertAdminProductEntitlementSchema>;
export type MigrationState = typeof migrationState.$inferSelect;
export type InsertMigrationState = z.infer<typeof insertMigrationStateSchema>;

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertJobSchema = createInsertSchema(jobs).omit({ id: true, createdAt: true });
export const insertApplicationSchema = createInsertSchema(applications).omit({ id: true, createdAt: true });
export const insertResourceSchema = createInsertSchema(resources).omit({ id: true, slug: true, createdAt: true, updatedAt: true });
export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({ id: true });
export const insertResumeSchema = createInsertSchema(resumes).omit({ id: true, createdAt: true });
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true });
export const insertCouponSchema = createInsertSchema(coupons).omit({ id: true, createdAt: true, currentUses: true });
export const insertPageSchema = createInsertSchema(pages).omit({ id: true, createdAt: true, updatedAt: true });
export const insertImportRunSchema = createInsertSchema(importRuns).omit({ id: true, uploadedAt: true });
export const insertImportArtifactSchema = createInsertSchema(importArtifacts).omit({ id: true });
export const insertSocialPostSchema = createInsertSchema(socialPosts).omit({ id: true, createdAt: true, updatedAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Application = typeof applications.$inferSelect;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type Resource = typeof resources.$inferSelect;
export type InsertResource = z.infer<typeof insertResourceSchema>;
export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type Resume = typeof resumes.$inferSelect;
export type InsertResume = z.infer<typeof insertResumeSchema>;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type Page = typeof pages.$inferSelect;
export type InsertPage = z.infer<typeof insertPageSchema>;
export type ImportRun = typeof importRuns.$inferSelect;
export type InsertImportRun = z.infer<typeof insertImportRunSchema>;
export type ImportArtifact = typeof importArtifacts.$inferSelect;
export type InsertImportArtifact = z.infer<typeof insertImportArtifactSchema>;
export type SocialPost = typeof socialPosts.$inferSelect;
export type InsertSocialPost = z.infer<typeof insertSocialPostSchema>;

// Site Settings
export interface SiteSettingsData {
  primaryColor: string;
  secondaryColor: string;
  headingFont: string;
  bodyFont: string;
  logoBase64: string | null;
  logoSize: "small" | "medium" | "large" | "x-large";
  faviconBase64: string | null;
  siteName: string;
  siteTitle: string;
  siteDescription: string;
  headerAnnouncement: string;
  headerAnnouncementLink: string;
  footerBgColor: string;
  footerBgOpacity: number;
  footerTextColor: string;
  footerLinkColor: string;
  footerLinkHoverColor: string;
  pageBackgroundColor: string;
  footerTagline: string;
  footerCopyright: string;
  socialTwitter: string;
  socialLinkedin: string;
  socialFacebook: string;
  socialInstagram: string;
  socialYoutube: string;
  socialTiktok: string;
  loginHeading: string;
  loginSubtitle: string;
  loginTestimonial: string;
  loginTestimonialAuthor: string;
  loginBackgroundImage: string;
  loginIconType: string;
  signupHeading: string;
  signupSubtitle: string;
  signupDescription: string;
  signupIconType: string;
  heroBadge: string;
  heroHeading: string;
  heroSubtext: string;
  heroPopularSearches: string;
  feature1Title: string;
  feature1Description: string;
  feature2Title: string;
  feature2Description: string;
  feature3Title: string;
  feature3Description: string;
  ctaHeading: string;
  ctaSubtext: string;
  ctaBackgroundImage: string;
  heroSize: "compact" | "default" | "large";
  heroBgColor: string;
  heroBorderColor: string;
  heroFontColor: string;
  heroHidden: boolean;
}

export const DEFAULT_SETTINGS: SiteSettingsData = {
  primaryColor: "#3b82f6",
  secondaryColor: "#f97316",
  headingFont: "Plus Jakarta Sans",
  bodyFont: "Inter",
  logoBase64: null,
  logoSize: "medium",
  faviconBase64: null,
  siteName: "LaneLogic Jobs",
  siteTitle: "LaneLogic Jobs – Transportation & Logistics Jobs",
  siteDescription: "Find the best transportation, trucking, and logistics jobs. Browse thousands of CDL and freight roles across the country.",
  headerAnnouncement: "",
  headerAnnouncementLink: "",
  footerBgColor: "#0b1220",
  footerBgOpacity: 1,
  footerTextColor: "#e5e7eb",
  footerLinkColor: "#93c5fd",
  footerLinkHoverColor: "#bfdbfe",
  pageBackgroundColor: "#ffffff",
  footerTagline: "The premier destination for transportation and logistics professionals to advance their careers.",
  footerCopyright: "© LaneLogic Jobs. All rights reserved.",
  socialTwitter: "",
  socialLinkedin: "",
  socialFacebook: "",
  socialInstagram: "",
  socialYoutube: "",
  socialTiktok: "",
  loginHeading: "",
  loginSubtitle: "",
  loginTestimonial: "",
  loginTestimonialAuthor: "",
  loginBackgroundImage: "",
  loginIconType: "truck",
  signupHeading: "",
  signupSubtitle: "",
  signupDescription: "",
  signupIconType: "truck",
  heroBadge: "",
  heroHeading: "",
  heroSubtext: "",
  heroPopularSearches: "",
  feature1Title: "",
  feature1Description: "",
  feature2Title: "",
  feature2Description: "",
  feature3Title: "",
  feature3Description: "",
  ctaHeading: "",
  ctaSubtext: "",
  ctaBackgroundImage: "",
  heroSize: "default",
  heroBgColor: "",
  heroBorderColor: "",
  heroFontColor: "",
  heroHidden: false,
};

export const siteSettings = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  settings: jsonb("settings").notNull().$type<SiteSettingsData>(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type SiteSettingsRow = typeof siteSettings.$inferSelect;

// Auth requests
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});