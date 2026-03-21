import { db } from "./db";
import {
  users, jobs, applications, resources, blogPosts, resumes, siteSettings, categories, coupons, pages,
  importRuns, importArtifacts, socialPosts,
  adminProducts, adminEntitlements, adminProductOverrides, adminProductEntitlements, migrationState,
  entitlementUsageWindows, entitlementCreditGrants, entitlementCreditConsumptions,
  jobSources, importTargets, jobImportRuns,
  employerVerificationRequests, employerEvidenceItems,
  seekerCredentialRequirements, seekerRequirementRules,
  seekerVerificationRequests, seekerCredentialEvidenceItems,
  conversations, messages, emailTemplates,
  type User, type InsertUser, type Job, type InsertJob,
  type Application, type InsertApplication,
  type Resource, type InsertResource,
  type BlogPost, type InsertBlogPost,
  type Resume, type InsertResume,
  type Category, type InsertCategory,
  type Coupon, type InsertCoupon,
  type Page, type InsertPage,
  type ImportRun, type InsertImportRun,
  type ImportArtifact, type InsertImportArtifact,
  type SocialPost, type InsertSocialPost,
  type AdminProduct, type InsertAdminProduct,
  type AdminEntitlement, type InsertAdminEntitlement,
  type AdminProductOverride, type InsertAdminProductOverride,
  type AdminProductEntitlement, type InsertAdminProductEntitlement,
  type MigrationState, type InsertMigrationState,
  type EntitlementUsageWindow, type InsertEntitlementUsageWindow,
  type EntitlementCreditGrant, type InsertEntitlementCreditGrant,
  type EntitlementCreditConsumption, type InsertEntitlementCreditConsumption,
  type SiteSettingsData, DEFAULT_SETTINGS,
  type JobSource, type InsertJobSource,
  type ImportTarget, type InsertImportTarget,
  type JobImportRun, type InsertJobImportRun,
  type EmployerVerificationRequest, type InsertEmployerVerificationRequest,
  type EmployerEvidenceItem, type InsertEmployerEvidenceItem,
  type SeekerCredentialRequirement, type InsertSeekerCredentialRequirement,
  type SeekerRequirementRule, type InsertSeekerRequirementRule,
  type SeekerVerificationRequest, type InsertSeekerVerificationRequest,
  type SeekerCredentialEvidenceItem, type InsertSeekerCredentialEvidenceItem,
  type Conversation, type InsertConversation,
  type Message, type InsertMessage,
  emailTemplates, type EmailTemplate, type InsertEmailTemplate,
} from "@shared/schema";
import { eq, and, sql, desc, asc, isNotNull, gte, lte, gt, ne, notInArray, inArray, count } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByEmailVerificationToken(token: string): Promise<User | undefined>;
  getUserByPasswordResetToken(token: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  findOrCreateEmployerByCompanyName(companyName: string): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User>;
  deleteUser(id: number): Promise<void>;

  // Jobs
  getJobs(): Promise<Job[]>;
  getJob(id: number): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: number, updates: Partial<InsertJob>): Promise<Job>;
  deleteJob(id: number): Promise<void>;

  // Applications
  getApplications(): Promise<Application[]>;
  createApplication(app: InsertApplication): Promise<Application>;
  updateApplication(id: number, updates: Partial<InsertApplication>): Promise<Application>;
  deleteApplication(id: number): Promise<void>;

  // Resources
  getResources(context?: "admin" | "public"): Promise<Resource[]>;
  getResource(id: number): Promise<Resource | undefined>;
  getResourceBySlug(slug: string): Promise<Resource | undefined>;
  createResource(resource: InsertResource): Promise<Resource>;
  updateResource(id: number, updates: Partial<InsertResource>): Promise<Resource>;
  deleteResource(id: number): Promise<void>;

  // Blog
  getBlogPosts(): Promise<BlogPost[]>;
  getBlogPost(id: number): Promise<BlogPost | undefined>;
  createBlogPost(post: InsertBlogPost): Promise<BlogPost>;
  updateBlogPost(id: number, updates: Partial<InsertBlogPost>): Promise<BlogPost>;
  deleteBlogPost(id: number): Promise<void>;

  // Resumes
  getResumes(jobSeekerId: number): Promise<Resume[]>;
  createResume(resume: InsertResume): Promise<Resume>;

  // Categories
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  deleteCategory(id: number): Promise<void>;

  // Coupons
  getCoupons(): Promise<Coupon[]>;
  getCoupon(id: number): Promise<Coupon | undefined>;
  getCouponByCode(code: string): Promise<Coupon | undefined>;
  createCoupon(coupon: InsertCoupon): Promise<Coupon>;
  updateCoupon(id: number, updates: Partial<InsertCoupon>): Promise<Coupon>;
  deleteCoupon(id: number): Promise<void>;
  incrementCouponUses(id: number): Promise<void>;

  // Pages
  getPages(): Promise<Page[]>;
  getPage(id: number): Promise<Page | undefined>;
  getPageBySlug(slug: string): Promise<Page | undefined>;
  createPage(page: InsertPage): Promise<Page>;
  updatePage(id: number, updates: Partial<InsertPage>): Promise<Page>;
  deletePage(id: number): Promise<void>;

  // Import Runs
  upsertJobByExternalKey(employerId: number, externalJobKey: string, job: InsertJob): Promise<Job>;
  createImportRun(run: InsertImportRun): Promise<ImportRun>;
  updateImportRun(id: number, updates: Partial<InsertImportRun>): Promise<ImportRun>;
  getImportRun(id: number): Promise<ImportRun | undefined>;
  getImportRuns(): Promise<ImportRun[]>;
  createImportArtifact(artifact: InsertImportArtifact): Promise<ImportArtifact>;
  getImportArtifact(runId: number, filename: string): Promise<ImportArtifact | undefined>;

  // Social Posts
  createSocialPost(data: InsertSocialPost): Promise<SocialPost>;
  getSocialPost(id: number): Promise<SocialPost | undefined>;
  listSocialPosts(filters?: { status?: string; entityType?: string }): Promise<SocialPost[]>;
  updateSocialPost(id: number, updates: Partial<InsertSocialPost>): Promise<SocialPost>;
  deleteSocialPost(id: number): Promise<void>;

  // Site Settings
  getSiteSettings(): Promise<SiteSettingsData>;
  updateSiteSettings(settings: SiteSettingsData): Promise<SiteSettingsData>;

  // Email Templates
  getEmailTemplates(): Promise<EmailTemplate[]>;
  getEmailTemplateBySlug(slug: string): Promise<EmailTemplate | undefined>;
  upsertEmailTemplate(slug: string, data: Partial<InsertEmailTemplate>): Promise<EmailTemplate>;

  // Admin Products
  getAdminProducts(): Promise<AdminProduct[]>;
  getAdminProduct(id: number): Promise<AdminProduct | undefined>;
  createAdminProduct(product: InsertAdminProduct): Promise<AdminProduct>;
  updateAdminProduct(id: number, updates: Partial<InsertAdminProduct>): Promise<AdminProduct>;
  deleteAdminProduct(id: number): Promise<void>;

  // Admin Entitlements
  getAdminEntitlements(): Promise<AdminEntitlement[]>;
  getAdminEntitlement(id: number): Promise<AdminEntitlement | undefined>;
  createAdminEntitlement(entitlement: InsertAdminEntitlement): Promise<AdminEntitlement>;
  updateAdminEntitlement(id: number, updates: Partial<InsertAdminEntitlement>): Promise<AdminEntitlement>;
  deleteAdminEntitlement(id: number): Promise<void>;

  // Admin Product Overrides
  getAdminProductOverrides(productId?: number): Promise<AdminProductOverride[]>;
  getAdminProductOverride(id: number): Promise<AdminProductOverride | undefined>;
  createAdminProductOverride(override: InsertAdminProductOverride): Promise<AdminProductOverride>;
  updateAdminProductOverride(id: number, updates: Partial<InsertAdminProductOverride>): Promise<AdminProductOverride>;
  deleteAdminProductOverride(id: number): Promise<void>;

  // Admin Product Entitlements (join table)
  getAdminProductEntitlements(productId: number): Promise<AdminProductEntitlement[]>;
  setAdminProductEntitlements(productId: number, entitlementIds: number[]): Promise<void>;

  // Migration State
  getMigrationState(key: string): Promise<MigrationState | undefined>;
  setMigrationState(state: InsertMigrationState): Promise<MigrationState>;

  // Entitlement Usage Windows
  getOrCreateUsageWindow(userId: number, entitlementKey: string, windowStart: Date, windowEnd: Date): Promise<EntitlementUsageWindow>;
  incrementUsageWindow(windowId: number): Promise<EntitlementUsageWindow>;
  incrementUsageWindowAtomic(windowId: number, maxCount: number): Promise<EntitlementUsageWindow | null>;

  // Entitlement Credit Grants
  createCreditGrant(grant: InsertEntitlementCreditGrant): Promise<EntitlementCreditGrant>;
  getActiveCreditGrants(userId: number, entitlementKey: string): Promise<EntitlementCreditGrant[]>;
  consumeCreditFromGrant(grantId: number, amount: number): Promise<EntitlementCreditGrant>;
  createCreditConsumption(consumption: InsertEntitlementCreditConsumption): Promise<EntitlementCreditConsumption>;
  getUserCreditSummary(userId: number, entitlementKey: string): Promise<{ totalRemaining: number; grants: EntitlementCreditGrant[] }>;
  getCreditGrantByPaymentIntent(paymentIntentId: string): Promise<EntitlementCreditGrant | undefined>;

  // Job Sources (Apify import pipeline)
  getJobSources(): Promise<JobSource[]>;
  getJobSource(id: number): Promise<JobSource | undefined>;
  createJobSource(source: InsertJobSource): Promise<JobSource>;
  updateJobSource(id: number, updates: Partial<InsertJobSource>): Promise<JobSource>;
  getActiveJobSourcesDueForPoll(): Promise<JobSource[]>;
  claimJobSourceForRun(sourceId: number): Promise<boolean>;

  // Import Targets (discovered Workday domains)
  getImportTargets(sourceId?: number): Promise<ImportTarget[]>;
  getImportTarget(id: number): Promise<ImportTarget | undefined>;
  upsertImportTarget(sourceId: number, sourceDomain: string, companyName: string, employerWebsiteDomain?: string | null): Promise<ImportTarget>;
  updateImportTarget(id: number, updates: Partial<InsertImportTarget>): Promise<ImportTarget>;
  getJobCountByImportTarget(importTargetId: number): Promise<number>;

  // Job Import Runs
  createJobImportRun(run: InsertJobImportRun): Promise<JobImportRun>;
  updateJobImportRun(id: number, updates: Partial<InsertJobImportRun>): Promise<JobImportRun>;
  getJobImportRuns(sourceId?: number, limit?: number): Promise<JobImportRun[]>;
  getJobImportRun(id: number): Promise<JobImportRun | undefined>;

  // Apify job upsert
  upsertImportedJob(sourceId: number, importTargetId: number, externalJobId: string, jobData: Partial<InsertJob>): Promise<{ job: Job; action: "created" | "updated" | "skipped" }>;
  expireJobsNotInSet(importTargetId: number, seenExternalJobIds: string[]): Promise<number>;
  expireJobsByImportTarget(importTargetId: number): Promise<number>;

  // Employer Verification
  getActiveVerificationRequest(employerId: number): Promise<EmployerVerificationRequest | undefined>;
  getLatestVerificationRequest(employerId: number): Promise<EmployerVerificationRequest | undefined>;
  getOrCreateVerificationRequest(employerId: number): Promise<EmployerVerificationRequest>;
  getVerificationRequestsByStatus(statuses: string[]): Promise<(EmployerVerificationRequest & { employerName: string | null; employerEmail: string })[]>;
  updateVerificationRequestStatus(requestId: number, status: string, adminNotes?: string, decidedBy?: number): Promise<EmployerVerificationRequest>;
  createEvidenceItem(item: InsertEmployerEvidenceItem): Promise<EmployerEvidenceItem>;
  getEvidenceItemsByRequest(requestId: number): Promise<EmployerEvidenceItem[]>;
  updateEmployerVerificationStatus(employerId: number, status: string): Promise<User>;

  // Seeker Credential Verification
  getSeekerCredentialRequirements(): Promise<SeekerCredentialRequirement[]>;
  upsertSeekerCredentialRequirement(req: InsertSeekerCredentialRequirement): Promise<SeekerCredentialRequirement>;
  getSeekerRequirementRules(): Promise<SeekerRequirementRule[]>;
  upsertSeekerRequirementRule(rule: InsertSeekerRequirementRule): Promise<SeekerRequirementRule>;
  getActiveSeekerVerificationRequest(seekerId: number): Promise<SeekerVerificationRequest | undefined>;
  getLatestSeekerVerificationRequest(seekerId: number): Promise<SeekerVerificationRequest | undefined>;
  getOrCreateSeekerVerificationRequest(seekerId: number): Promise<SeekerVerificationRequest>;
  appendRequirementsSnapshot(requestId: number, keys: string[]): Promise<SeekerVerificationRequest>;
  getSeekerVerificationRequestsByStatus(statuses: string[]): Promise<(SeekerVerificationRequest & { seekerName: string | null; seekerEmail: string; seekerTrack: string | null; cdlIsNonDomiciled: boolean; cdlMarkedNonDomiciledIssuingState: boolean })[]>;
  updateSeekerVerificationRequestStatus(requestId: number, status: string, adminNotes?: string, decidedBy?: number): Promise<SeekerVerificationRequest>;
  createSeekerEvidenceItem(item: InsertSeekerCredentialEvidenceItem): Promise<SeekerCredentialEvidenceItem>;
  getSeekerEvidenceItemsByRequest(requestId: number): Promise<SeekerCredentialEvidenceItem[]>;
  updateSeekerVerificationStatus(seekerId: number, status: string): Promise<User>;

  // Messaging
  getOrCreateConversation(seekerId: number, employerId: number, jobId?: number | null): Promise<Conversation>;
  getConversations(userId: number): Promise<(Conversation & { otherPartyName: string; lastMessage: string | null; unreadCount: number })[]>;
  getMessages(conversationId: number): Promise<Message[]>;
  createMessage(conversationId: number, senderId: number, content: string): Promise<Message>;
  markConversationRead(conversationId: number, userId: number): Promise<void>;
  getUnreadMessageCount(userId: number): Promise<number>;
  getConversationUnreadCount(conversationId: number, recipientId: number): Promise<number>;
  getConversation(conversationId: number): Promise<Conversation | undefined>;

  // Employer enriched applicants
  getEmployerApplicationsEnriched(employerId: number): Promise<(Application & { seekerName: string; seekerEmail: string; employerNotes?: string | null })[]>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }
  async getUserByEmailVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.emailVerificationToken, token));
    return user;
  }
  async getUserByPasswordResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.passwordResetToken, token));
    return user;
  }
  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  async findOrCreateEmployerByCompanyName(companyName: string): Promise<User> {
    const normalized = companyName.trim();
    const [existing] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.role, "employer"),
          sql`lower(${users.companyName}) = lower(${normalized})`
        )
      )
      .limit(1);
    if (existing) return existing;
    const slug = normalized.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    const baseEmail = `employer+${slug}@auto.lanelogicjobs.com`;
    let email = baseEmail;
    let suffix = 1;
    while (await this.getUserByEmail(email)) {
      email = `employer+${slug}-${suffix}@auto.lanelogicjobs.com`;
      suffix++;
    }
    const [created] = await db
      .insert(users)
      .values({ email, password: "", role: "employer", companyName: normalized, membershipTier: "free" })
      .returning();
    return created;
  }
  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }
  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // Jobs
  async getJobs(): Promise<Job[]> {
    return await db.select().from(jobs).orderBy(desc(jobs.createdAt));
  }
  async getJob(id: number): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job;
  }
  async createJob(insertJob: InsertJob): Promise<Job> {
    const [job] = await db.insert(jobs).values(insertJob).returning();
    return job;
  }
  async updateJob(id: number, updates: Partial<InsertJob>): Promise<Job> {
    const [job] = await db.update(jobs).set(updates).where(eq(jobs.id, id)).returning();
    return job;
  }
  async deleteJob(id: number): Promise<void> {
    await db.delete(jobs).where(eq(jobs.id, id));
  }

  // Applications
  async getApplications(): Promise<Application[]> {
    return await db.select().from(applications);
  }
  async updateApplication(id: number, updates: Partial<InsertApplication>): Promise<Application> {
    const [app] = await db.update(applications).set(updates).where(eq(applications.id, id)).returning();
    return app;
  }
  async deleteApplication(id: number): Promise<void> {
    await db.delete(applications).where(eq(applications.id, id));
  }

  // Resources
  async getResources(context: "admin" | "public" = "public"): Promise<Resource[]> {
    if (context === "admin") {
      return await db.select().from(resources).orderBy(desc(resources.updatedAt));
    }
    return await db.select().from(resources)
      .where(eq(resources.isPublished, true))
      .orderBy(desc(resources.publishedAt), desc(resources.id));
  }
  async getResource(id: number): Promise<Resource | undefined> {
    const [res] = await db.select().from(resources).where(eq(resources.id, id));
    return res;
  }
  async getResourceBySlug(slug: string): Promise<Resource | undefined> {
    const [res] = await db.select().from(resources).where(eq(resources.slug, slug));
    return res;
  }
  private async generateUniqueResourceSlug(title: string): Promise<string> {
    let base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
    if (!base || /^\d+$/.test(base)) {
      base = base ? `resource-${base}` : "resource";
    }
    let slug = base;
    let suffix = 2;
    while (true) {
      const existing = await this.getResourceBySlug(slug);
      if (!existing) return slug;
      slug = `${base}-${suffix}`;
      suffix++;
    }
  }
  async createResource(resource: InsertResource): Promise<Resource> {
    const slug = await this.generateUniqueResourceSlug(resource.title);
    const [res] = await db.insert(resources).values({ ...resource, slug }).returning();
    return res;
  }
  async updateResource(id: number, updates: Partial<InsertResource>): Promise<Resource> {
    const [res] = await db.update(resources).set({ ...updates, updatedAt: new Date() }).where(eq(resources.id, id)).returning();
    return res;
  }
  async deleteResource(id: number): Promise<void> {
    await db.delete(resources).where(eq(resources.id, id));
  }

  // Blog
  async getBlogPosts(): Promise<BlogPost[]> {
    return await db.select().from(blogPosts);
  }
  async getBlogPost(id: number): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    return post;
  }
  async createBlogPost(post: InsertBlogPost): Promise<BlogPost> {
    const [blogPost] = await db.insert(blogPosts).values(post).returning();
    return blogPost;
  }
  async updateBlogPost(id: number, updates: Partial<InsertBlogPost>): Promise<BlogPost> {
    const [post] = await db.update(blogPosts).set(updates).where(eq(blogPosts.id, id)).returning();
    return post;
  }
  async deleteBlogPost(id: number): Promise<void> {
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
  }

  // Resumes
  async getResumes(jobSeekerId: number): Promise<Resume[]> {
    return await db.select().from(resumes).where(eq(resumes.jobSeekerId, jobSeekerId));
  }
  async createResume(resume: InsertResume): Promise<Resume> {
    const [res] = await db.insert(resumes).values(resume).returning();
    return res;
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }
  async createCategory(category: InsertCategory): Promise<Category> {
    const [cat] = await db.insert(categories).values(category).returning();
    return cat;
  }
  async deleteCategory(id: number): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  // Coupons
  async getCoupons(): Promise<Coupon[]> {
    return await db.select().from(coupons);
  }
  async getCoupon(id: number): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.id, id));
    return coupon;
  }
  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code));
    return coupon;
  }
  async createCoupon(coupon: InsertCoupon): Promise<Coupon> {
    const [c] = await db.insert(coupons).values(coupon).returning();
    return c;
  }
  async updateCoupon(id: number, updates: Partial<InsertCoupon>): Promise<Coupon> {
    const [c] = await db.update(coupons).set(updates).where(eq(coupons.id, id)).returning();
    return c;
  }
  async deleteCoupon(id: number): Promise<void> {
    await db.delete(coupons).where(eq(coupons.id, id));
  }
  async incrementCouponUses(id: number): Promise<void> {
    await db.update(coupons)
      .set({ currentUses: sql`${coupons.currentUses} + 1` })
      .where(eq(coupons.id, id));
  }

  // Pages
  async getPages(): Promise<Page[]> {
    return await db.select().from(pages).orderBy(desc(pages.createdAt));
  }
  async getPage(id: number): Promise<Page | undefined> {
    const [page] = await db.select().from(pages).where(eq(pages.id, id));
    return page;
  }
  async getPageBySlug(slug: string): Promise<Page | undefined> {
    const [page] = await db.select().from(pages).where(eq(pages.slug, slug));
    return page;
  }
  async createPage(page: InsertPage): Promise<Page> {
    const [p] = await db.insert(pages).values(page).returning();
    return p;
  }
  async updatePage(id: number, updates: Partial<InsertPage>): Promise<Page> {
    const [p] = await db.update(pages).set({ ...updates, updatedAt: new Date() }).where(eq(pages.id, id)).returning();
    return p;
  }
  async deletePage(id: number): Promise<void> {
    await db.delete(pages).where(eq(pages.id, id));
  }

  // Import Runs
  async upsertJobByExternalKey(employerId: number, externalJobKey: string, job: InsertJob): Promise<Job> {
    const existing = await db.select().from(jobs).where(
      and(eq(jobs.employerId, employerId), eq(jobs.externalJobKey, externalJobKey))
    );
    if (existing.length > 0) {
      const { employerId: _eid, externalJobKey: _ek, ...updates } = job;
      const [updated] = await db.update(jobs).set(updates).where(eq(jobs.id, existing[0].id)).returning();
      return updated;
    }
    const [created] = await db.insert(jobs).values(job).returning();
    return created;
  }
  async createImportRun(run: InsertImportRun): Promise<ImportRun> {
    const [r] = await db.insert(importRuns).values(run).returning();
    return r;
  }
  async updateImportRun(id: number, updates: Partial<InsertImportRun>): Promise<ImportRun> {
    const [r] = await db.update(importRuns).set(updates).where(eq(importRuns.id, id)).returning();
    return r;
  }
  async getImportRun(id: number): Promise<ImportRun | undefined> {
    const [r] = await db.select().from(importRuns).where(eq(importRuns.id, id));
    return r;
  }
  async getImportRuns(): Promise<ImportRun[]> {
    return await db.select().from(importRuns).orderBy(desc(importRuns.uploadedAt));
  }
  async createImportArtifact(artifact: InsertImportArtifact): Promise<ImportArtifact> {
    const [a] = await db.insert(importArtifacts).values(artifact).returning();
    return a;
  }
  async getImportArtifact(runId: number, filename: string): Promise<ImportArtifact | undefined> {
    const [a] = await db.select().from(importArtifacts).where(
      and(eq(importArtifacts.runId, runId), eq(importArtifacts.filename, filename))
    );
    return a;
  }

  // Social Posts
  async createSocialPost(data: InsertSocialPost): Promise<SocialPost> {
    const [post] = await db.insert(socialPosts).values(data).returning();
    return post;
  }
  async getSocialPost(id: number): Promise<SocialPost | undefined> {
    const [post] = await db.select().from(socialPosts).where(eq(socialPosts.id, id));
    return post;
  }
  async listSocialPosts(filters?: { status?: string; entityType?: string }): Promise<SocialPost[]> {
    const conditions = [];
    if (filters?.status) conditions.push(eq(socialPosts.status, filters.status));
    if (filters?.entityType) conditions.push(eq(socialPosts.entityType, filters.entityType));
    if (conditions.length > 0) {
      return await db.select().from(socialPosts).where(and(...conditions)).orderBy(desc(socialPosts.createdAt));
    }
    return await db.select().from(socialPosts).orderBy(desc(socialPosts.createdAt));
  }
  async updateSocialPost(id: number, updates: Partial<InsertSocialPost>): Promise<SocialPost> {
    const [post] = await db.update(socialPosts).set({ ...updates, updatedAt: new Date() }).where(eq(socialPosts.id, id)).returning();
    return post;
  }
  async deleteSocialPost(id: number): Promise<void> {
    await db.delete(socialPosts).where(eq(socialPosts.id, id));
  }

  // Site Settings
  async getSiteSettings(): Promise<SiteSettingsData> {
    const rows = await db.select().from(siteSettings).limit(1);
    if (rows.length === 0) return { ...DEFAULT_SETTINGS };
    return rows[0].settings;
  }
  async updateSiteSettings(settings: SiteSettingsData): Promise<SiteSettingsData> {
    const rows = await db.select().from(siteSettings).limit(1);
    if (rows.length === 0) {
      const [row] = await db.insert(siteSettings).values({ settings }).returning();
      return row.settings;
    } else {
      const [row] = await db.update(siteSettings)
        .set({ settings, updatedAt: new Date() })
        .where(eq(siteSettings.id, rows[0].id))
        .returning();
      return row.settings;
    }
  }
  // Admin Products
  async getAdminProducts(): Promise<AdminProduct[]> {
    return await db.select().from(adminProducts).orderBy(desc(adminProducts.createdAt));
  }
  async getAdminProduct(id: number): Promise<AdminProduct | undefined> {
    const [p] = await db.select().from(adminProducts).where(eq(adminProducts.id, id));
    return p;
  }
  async createAdminProduct(product: InsertAdminProduct): Promise<AdminProduct> {
    const [p] = await db.insert(adminProducts).values(product).returning();
    return p;
  }
  async updateAdminProduct(id: number, updates: Partial<InsertAdminProduct>): Promise<AdminProduct> {
    const [p] = await db.update(adminProducts).set({ ...updates, updatedAt: new Date() }).where(eq(adminProducts.id, id)).returning();
    return p;
  }
  async deleteAdminProduct(id: number): Promise<void> {
    await db.delete(adminProductEntitlements).where(eq(adminProductEntitlements.productId, id));
    await db.delete(adminProductOverrides).where(eq(adminProductOverrides.productId, id));
    await db.delete(adminProducts).where(eq(adminProducts.id, id));
  }

  // Admin Entitlements
  async getAdminEntitlements(): Promise<AdminEntitlement[]> {
    return await db.select().from(adminEntitlements).orderBy(desc(adminEntitlements.createdAt));
  }
  async getAdminEntitlement(id: number): Promise<AdminEntitlement | undefined> {
    const [e] = await db.select().from(adminEntitlements).where(eq(adminEntitlements.id, id));
    return e;
  }
  async createAdminEntitlement(entitlement: InsertAdminEntitlement): Promise<AdminEntitlement> {
    const [e] = await db.insert(adminEntitlements).values(entitlement).returning();
    return e;
  }
  async updateAdminEntitlement(id: number, updates: Partial<InsertAdminEntitlement>): Promise<AdminEntitlement> {
    const [e] = await db.update(adminEntitlements).set({ ...updates, updatedAt: new Date() }).where(eq(adminEntitlements.id, id)).returning();
    return e;
  }
  async deleteAdminEntitlement(id: number): Promise<void> {
    await db.delete(adminProductOverrides).where(eq(adminProductOverrides.entitlementId, id));
    await db.delete(adminProductEntitlements).where(eq(adminProductEntitlements.entitlementId, id));
    await db.delete(adminEntitlements).where(eq(adminEntitlements.id, id));
  }

  // Admin Product Overrides
  async getAdminProductOverrides(productId?: number): Promise<AdminProductOverride[]> {
    if (productId !== undefined) {
      return await db.select().from(adminProductOverrides).where(eq(adminProductOverrides.productId, productId));
    }
    return await db.select().from(adminProductOverrides);
  }
  async getAdminProductOverride(id: number): Promise<AdminProductOverride | undefined> {
    const [o] = await db.select().from(adminProductOverrides).where(eq(adminProductOverrides.id, id));
    return o;
  }
  async createAdminProductOverride(override: InsertAdminProductOverride): Promise<AdminProductOverride> {
    const [o] = await db.insert(adminProductOverrides).values(override).returning();
    return o;
  }
  async updateAdminProductOverride(id: number, updates: Partial<InsertAdminProductOverride>): Promise<AdminProductOverride> {
    const [o] = await db.update(adminProductOverrides).set({ ...updates, updatedAt: new Date() }).where(eq(adminProductOverrides.id, id)).returning();
    return o;
  }
  async deleteAdminProductOverride(id: number): Promise<void> {
    await db.delete(adminProductOverrides).where(eq(adminProductOverrides.id, id));
  }

  // Admin Product Entitlements (join table)
  async getAdminProductEntitlements(productId: number): Promise<AdminProductEntitlement[]> {
    return await db.select().from(adminProductEntitlements).where(eq(adminProductEntitlements.productId, productId));
  }
  async setAdminProductEntitlements(productId: number, entitlementIds: number[]): Promise<void> {
    await db.delete(adminProductEntitlements).where(eq(adminProductEntitlements.productId, productId));
    if (entitlementIds.length > 0) {
      await db.insert(adminProductEntitlements).values(
        entitlementIds.map(eid => ({ productId, entitlementId: eid }))
      );
    }
  }

  // Migration State
  async getMigrationState(key: string): Promise<MigrationState | undefined> {
    const [m] = await db.select().from(migrationState).where(eq(migrationState.key, key));
    return m;
  }
  async setMigrationState(state: InsertMigrationState): Promise<MigrationState> {
    const existing = await this.getMigrationState(state.key);
    if (existing) {
      const [m] = await db.update(migrationState).set(state).where(eq(migrationState.key, state.key)).returning();
      return m;
    }
    const [m] = await db.insert(migrationState).values(state).returning();
    return m;
  }

  // Entitlement Usage Windows
  async getOrCreateUsageWindow(userId: number, entitlementKey: string, windowStart: Date, windowEnd: Date, txDb: any = db): Promise<EntitlementUsageWindow> {
    const [w] = await txDb.insert(entitlementUsageWindows).values({
      userId, entitlementKey, windowStart, windowEnd, usedCount: 0
    }).onConflictDoNothing().returning();
    if (w) return w;
    const [existing] = await txDb.select().from(entitlementUsageWindows).where(
      and(
        eq(entitlementUsageWindows.userId, userId),
        eq(entitlementUsageWindows.entitlementKey, entitlementKey),
        eq(entitlementUsageWindows.windowStart, windowStart)
      )
    );
    return existing;
  }

  async incrementUsageWindow(windowId: number, txDb: any = db): Promise<EntitlementUsageWindow> {
    const [w] = await txDb.update(entitlementUsageWindows)
      .set({ usedCount: sql`${entitlementUsageWindows.usedCount} + 1` })
      .where(eq(entitlementUsageWindows.id, windowId))
      .returning();
    return w;
  }

  async incrementUsageWindowAtomic(windowId: number, maxCount: number, txDb: any = db): Promise<EntitlementUsageWindow | null> {
    const rows = await txDb.update(entitlementUsageWindows)
      .set({ usedCount: sql`${entitlementUsageWindows.usedCount} + 1` })
      .where(and(
        eq(entitlementUsageWindows.id, windowId),
        sql`${entitlementUsageWindows.usedCount} < ${maxCount}`
      ))
      .returning();
    return rows.length > 0 ? rows[0] : null;
  }

  // Entitlement Credit Grants
  async createCreditGrant(grant: InsertEntitlementCreditGrant, txDb: any = db): Promise<EntitlementCreditGrant> {
    const [g] = await txDb.insert(entitlementCreditGrants).values(grant).returning();
    return g;
  }

  async getActiveCreditGrants(userId: number, entitlementKey: string, txDb: any = db): Promise<EntitlementCreditGrant[]> {
    const now = new Date();
    return await txDb.select().from(entitlementCreditGrants).where(
      and(
        eq(entitlementCreditGrants.userId, userId),
        eq(entitlementCreditGrants.entitlementKey, entitlementKey),
        eq(entitlementCreditGrants.status, "Active"),
        gt(entitlementCreditGrants.amountRemaining, 0),
        gt(entitlementCreditGrants.expiresAt, now)
      )
    ).orderBy(asc(entitlementCreditGrants.expiresAt), asc(entitlementCreditGrants.grantedAt));
  }

  async consumeCreditFromGrant(grantId: number, amount: number, txDb: any = db): Promise<EntitlementCreditGrant> {
    const [g] = await txDb.update(entitlementCreditGrants)
      .set({ amountRemaining: sql`${entitlementCreditGrants.amountRemaining} - ${amount}` })
      .where(and(
        eq(entitlementCreditGrants.id, grantId),
        gte(entitlementCreditGrants.amountRemaining, amount)
      ))
      .returning();
    return g;
  }

  async createCreditConsumption(consumption: InsertEntitlementCreditConsumption, txDb: any = db): Promise<EntitlementCreditConsumption> {
    const [c] = await txDb.insert(entitlementCreditConsumptions).values(consumption).returning();
    return c;
  }

  async getUserCreditSummary(userId: number, entitlementKey: string, txDb: any = db): Promise<{ totalRemaining: number; grants: EntitlementCreditGrant[] }> {
    const grants = await this.getActiveCreditGrants(userId, entitlementKey, txDb);
    const totalRemaining = grants.reduce((sum, g) => sum + g.amountRemaining, 0);
    return { totalRemaining, grants };
  }

  async getCreditGrantByPaymentIntent(paymentIntentId: string, txDb: any = db): Promise<EntitlementCreditGrant | undefined> {
    const [g] = await txDb.select().from(entitlementCreditGrants).where(
      eq(entitlementCreditGrants.stripePaymentIntentId, paymentIntentId)
    );
    return g;
  }

  async createApplication(insertApp: InsertApplication, txDb: any = db): Promise<Application> {
    const [app] = await txDb.insert(applications).values(insertApp).returning();
    return app;
  }

  async runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return db.transaction(fn);
  }

  // Job Sources
  async getJobSources(): Promise<JobSource[]> {
    return await db.select().from(jobSources).orderBy(desc(jobSources.createdAt));
  }
  async getJobSource(id: number): Promise<JobSource | undefined> {
    const [s] = await db.select().from(jobSources).where(eq(jobSources.id, id));
    return s;
  }
  async createJobSource(source: InsertJobSource): Promise<JobSource> {
    const [s] = await db.insert(jobSources).values(source).returning();
    return s;
  }
  async updateJobSource(id: number, updates: Partial<InsertJobSource>): Promise<JobSource> {
    const [s] = await db.update(jobSources).set({ ...updates, updatedAt: new Date() }).where(eq(jobSources.id, id)).returning();
    return s;
  }
  async getActiveJobSourcesDueForPoll(): Promise<JobSource[]> {
    return await db.select().from(jobSources).where(
      and(
        eq(jobSources.status, "active"),
        sql`(${jobSources.lastRunAt} IS NULL OR ${jobSources.lastRunAt} < NOW() - (${jobSources.pollIntervalMinutes} || ' minutes')::interval)`
      )
    );
  }
  async claimJobSourceForRun(sourceId: number): Promise<boolean> {
    const rows = await db.update(jobSources)
      .set({ lastRunAt: new Date() })
      .where(
        and(
          eq(jobSources.id, sourceId),
          eq(jobSources.status, "active"),
          sql`(${jobSources.lastRunAt} IS NULL OR ${jobSources.lastRunAt} < NOW() - (${jobSources.pollIntervalMinutes} || ' minutes')::interval)`
        )
      )
      .returning();
    return rows.length > 0;
  }

  // Import Targets
  async getImportTargets(sourceId?: number): Promise<ImportTarget[]> {
    if (sourceId !== undefined) {
      return await db.select().from(importTargets).where(eq(importTargets.sourceId, sourceId)).orderBy(desc(importTargets.lastSeenAt));
    }
    return await db.select().from(importTargets).orderBy(desc(importTargets.lastSeenAt));
  }
  async getImportTarget(id: number): Promise<ImportTarget | undefined> {
    const [t] = await db.select().from(importTargets).where(eq(importTargets.id, id));
    return t;
  }
  async upsertImportTarget(sourceId: number, sourceDomain: string, companyName: string, employerWebsiteDomain?: string | null): Promise<ImportTarget> {
    const existing = await db.select().from(importTargets).where(
      and(eq(importTargets.sourceId, sourceId), eq(importTargets.sourceDomain, sourceDomain))
    );
    if (existing.length > 0) {
      const updates: any = { companyName, lastSeenAt: new Date() };
      if (employerWebsiteDomain) updates.employerWebsiteDomain = employerWebsiteDomain;
      const [t] = await db.update(importTargets).set(updates).where(eq(importTargets.id, existing[0].id)).returning();
      return t;
    }
    const [t] = await db.insert(importTargets).values({
      sourceId, sourceDomain, companyName,
      employerWebsiteDomain: employerWebsiteDomain || null,
      status: "pending_review",
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
    }).returning();
    return t;
  }
  async updateImportTarget(id: number, updates: Partial<InsertImportTarget>): Promise<ImportTarget> {
    const [t] = await db.update(importTargets).set(updates).where(eq(importTargets.id, id)).returning();
    return t;
  }
  async getJobCountByImportTarget(importTargetId: number): Promise<number> {
    const [result] = await db.select({ cnt: count() }).from(jobs).where(
      and(eq(jobs.importTargetId, importTargetId), ne(jobs.status, "expired"))
    );
    return Number(result?.cnt || 0);
  }

  // Job Import Runs
  async createJobImportRun(run: InsertJobImportRun): Promise<JobImportRun> {
    const [r] = await db.insert(jobImportRuns).values(run).returning();
    return r;
  }
  async updateJobImportRun(id: number, updates: Partial<InsertJobImportRun>): Promise<JobImportRun> {
    const [r] = await db.update(jobImportRuns).set(updates).where(eq(jobImportRuns.id, id)).returning();
    return r;
  }
  async getJobImportRuns(sourceId?: number, limit: number = 50): Promise<JobImportRun[]> {
    if (sourceId !== undefined) {
      return await db.select().from(jobImportRuns).where(eq(jobImportRuns.sourceId, sourceId)).orderBy(desc(jobImportRuns.createdAt)).limit(limit);
    }
    return await db.select().from(jobImportRuns).orderBy(desc(jobImportRuns.createdAt)).limit(limit);
  }
  async getJobImportRun(id: number): Promise<JobImportRun | undefined> {
    const [r] = await db.select().from(jobImportRuns).where(eq(jobImportRuns.id, id));
    return r;
  }

  // Apify job upsert (idempotent)
  async upsertImportedJob(sourceId: number, importTargetId: number, externalJobId: string, jobData: Partial<InsertJob>): Promise<{ job: Job; action: "created" | "updated" | "skipped" }> {
    const [existing] = await db.select().from(jobs).where(
      and(
        eq(jobs.sourceId, sourceId),
        eq(jobs.importTargetId, importTargetId),
        eq(jobs.externalJobId, externalJobId)
      )
    );
    const now = new Date();
    if (!existing) {
      const [job] = await db.insert(jobs).values({
        employerId: 0,
        title: jobData.title || "Untitled",
        description: jobData.description || "",
        requirements: jobData.requirements || "",
        companyName: jobData.companyName,
        jobType: jobData.jobType,
        locationCity: jobData.locationCity,
        locationState: jobData.locationState,
        locationCountry: jobData.locationCountry,
        applyUrl: jobData.applyUrl,
        isExternalApply: true,
        isPublished: false,
        sourceId,
        importTargetId,
        externalJobId,
        sourceUrl: jobData.sourceUrl,
        externalPostedAt: jobData.externalPostedAt,
        externalCreatedAt: jobData.externalCreatedAt,
        externalValidThrough: jobData.externalValidThrough,
        employmentType: jobData.employmentType,
        isRemote: jobData.isRemote,
        workLocationType: jobData.workLocationType,
        status: "draft",
        importedAt: now,
        lastImportedAt: now,
        rawSourceSnippet: jobData.rawSourceSnippet,
      } as InsertJob).returning();
      return { job, action: "created" };
    }

    const safeUpdates: any = {
      sourceUrl: jobData.sourceUrl,
      externalPostedAt: jobData.externalPostedAt,
      externalCreatedAt: jobData.externalCreatedAt,
      externalValidThrough: jobData.externalValidThrough,
      locationCity: jobData.locationCity,
      locationState: jobData.locationState,
      locationCountry: jobData.locationCountry,
      employmentType: jobData.employmentType,
      isRemote: jobData.isRemote,
      workLocationType: jobData.workLocationType,
      lastImportedAt: now,
      rawSourceSnippet: jobData.rawSourceSnippet,
    };
    if (existing.status === "expired") {
      safeUpdates.status = "draft";
    }
    if (!existing.lastAdminEditedAt) {
      if (jobData.title) safeUpdates.title = jobData.title;
      if (jobData.description) safeUpdates.description = jobData.description;
    }

    const [job] = await db.update(jobs).set(safeUpdates).where(eq(jobs.id, existing.id)).returning();
    return { job, action: "updated" };
  }

  async expireJobsNotInSet(importTargetId: number, seenExternalJobIds: string[]): Promise<number> {
    const conditions = [
      eq(jobs.importTargetId, importTargetId),
      ne(jobs.status, "expired"),
    ];
    if (seenExternalJobIds.length > 0) {
      conditions.push(sql`${jobs.externalJobId} IS NOT NULL`);
      conditions.push(notInArray(jobs.externalJobId, seenExternalJobIds));
    }
    const rows = await db.update(jobs)
      .set({ status: "expired", isPublished: false })
      .where(and(...conditions))
      .returning();
    return rows.length;
  }

  async expireJobsByImportTarget(importTargetId: number): Promise<number> {
    const rows = await db.update(jobs)
      .set({ status: "expired", isPublished: false })
      .where(and(eq(jobs.importTargetId, importTargetId), ne(jobs.status, "expired")))
      .returning();
    return rows.length;
  }

  async getActiveVerificationRequest(employerId: number): Promise<EmployerVerificationRequest | undefined> {
    const [req] = await db.select().from(employerVerificationRequests)
      .where(and(
        eq(employerVerificationRequests.employerId, employerId),
        inArray(employerVerificationRequests.status, ["draft", "submitted", "needs_more"])
      ))
      .limit(1);
    return req;
  }

  async getLatestVerificationRequest(employerId: number): Promise<EmployerVerificationRequest | undefined> {
    const [req] = await db.select().from(employerVerificationRequests)
      .where(eq(employerVerificationRequests.employerId, employerId))
      .orderBy(desc(employerVerificationRequests.createdAt))
      .limit(1);
    return req;
  }

  async getOrCreateVerificationRequest(employerId: number): Promise<EmployerVerificationRequest> {
    const existing = await this.getActiveVerificationRequest(employerId);
    if (existing) return existing;
    try {
      const [req] = await db.insert(employerVerificationRequests)
        .values({ employerId, status: "draft" })
        .returning();
      return req;
    } catch (err: any) {
      if (err?.code === "23505") {
        const fallback = await this.getActiveVerificationRequest(employerId);
        if (fallback) return fallback;
      }
      throw err;
    }
  }

  async getVerificationRequestsByStatus(statuses: string[]): Promise<(EmployerVerificationRequest & { employerName: string | null; employerEmail: string })[]> {
    const rows = await db
      .select({
        id: employerVerificationRequests.id,
        employerId: employerVerificationRequests.employerId,
        status: employerVerificationRequests.status,
        adminNotes: employerVerificationRequests.adminNotes,
        decidedBy: employerVerificationRequests.decidedBy,
        decidedAt: employerVerificationRequests.decidedAt,
        submittedAt: employerVerificationRequests.submittedAt,
        createdAt: employerVerificationRequests.createdAt,
        updatedAt: employerVerificationRequests.updatedAt,
        employerName: users.companyName,
        employerEmail: users.email,
      })
      .from(employerVerificationRequests)
      .innerJoin(users, eq(employerVerificationRequests.employerId, users.id))
      .where(inArray(employerVerificationRequests.status, statuses))
      .orderBy(desc(employerVerificationRequests.submittedAt));
    return rows;
  }

  async updateVerificationRequestStatus(requestId: number, status: string, adminNotes?: string, decidedBy?: number): Promise<EmployerVerificationRequest> {
    const updates: Record<string, any> = { status, updatedAt: new Date() };
    if (adminNotes !== undefined) updates.adminNotes = adminNotes;
    if (decidedBy !== undefined) updates.decidedBy = decidedBy;
    if (status === "submitted") updates.submittedAt = new Date();
    if (["verified", "rejected"].includes(status)) updates.decidedAt = new Date();
    const [req] = await db.update(employerVerificationRequests)
      .set(updates)
      .where(eq(employerVerificationRequests.id, requestId))
      .returning();
    return req;
  }

  async createEvidenceItem(item: InsertEmployerEvidenceItem): Promise<EmployerEvidenceItem> {
    const [evidence] = await db.insert(employerEvidenceItems).values(item).returning();
    return evidence;
  }

  async getEvidenceItemsByRequest(requestId: number): Promise<EmployerEvidenceItem[]> {
    return await db.select().from(employerEvidenceItems)
      .where(eq(employerEvidenceItems.requestId, requestId))
      .orderBy(desc(employerEvidenceItems.createdAt));
  }

  async updateEmployerVerificationStatus(employerId: number, status: string): Promise<User> {
    const [user] = await db.update(users)
      .set({ verificationStatus: status })
      .where(eq(users.id, employerId))
      .returning();
    return user;
  }

  // Seeker Credential Verification
  async getSeekerCredentialRequirements(): Promise<SeekerCredentialRequirement[]> {
    return await db.select().from(seekerCredentialRequirements).orderBy(asc(seekerCredentialRequirements.key));
  }

  async upsertSeekerCredentialRequirement(req: InsertSeekerCredentialRequirement): Promise<SeekerCredentialRequirement> {
    const [result] = await db.insert(seekerCredentialRequirements)
      .values(req)
      .onConflictDoUpdate({ target: seekerCredentialRequirements.key, set: { label: req.label, description: req.description ?? null, category: req.category ?? "license" } })
      .returning();
    return result;
  }

  async getSeekerRequirementRules(): Promise<SeekerRequirementRule[]> {
    return await db.select().from(seekerRequirementRules);
  }

  async upsertSeekerRequirementRule(rule: InsertSeekerRequirementRule): Promise<SeekerRequirementRule> {
    const existing = await db.select().from(seekerRequirementRules)
      .where(and(
        eq(seekerRequirementRules.requirementKey, rule.requirementKey),
        eq(seekerRequirementRules.conditionType, rule.conditionType),
        eq(seekerRequirementRules.conditionValue, rule.conditionValue)
      ))
      .limit(1);
    if (existing.length > 0) return existing[0];
    const [result] = await db.insert(seekerRequirementRules).values(rule).returning();
    return result;
  }

  async getActiveSeekerVerificationRequest(seekerId: number): Promise<SeekerVerificationRequest | undefined> {
    const [req] = await db.select().from(seekerVerificationRequests)
      .where(and(
        eq(seekerVerificationRequests.seekerId, seekerId),
        inArray(seekerVerificationRequests.status, ["draft", "submitted", "needs_more"])
      ))
      .limit(1);
    return req;
  }

  async getLatestSeekerVerificationRequest(seekerId: number): Promise<SeekerVerificationRequest | undefined> {
    const [req] = await db.select().from(seekerVerificationRequests)
      .where(eq(seekerVerificationRequests.seekerId, seekerId))
      .orderBy(desc(seekerVerificationRequests.createdAt))
      .limit(1);
    return req;
  }

  async getOrCreateSeekerVerificationRequest(seekerId: number): Promise<SeekerVerificationRequest> {
    const existing = await this.getActiveSeekerVerificationRequest(seekerId);
    if (existing) return existing;
    try {
      const [req] = await db.insert(seekerVerificationRequests)
        .values({ seekerId, status: "draft" })
        .returning();
      return req;
    } catch (err: any) {
      if (err?.code === "23505") {
        const fallback = await this.getActiveSeekerVerificationRequest(seekerId);
        if (fallback) return fallback;
      }
      throw err;
    }
  }

  async appendRequirementsSnapshot(requestId: number, keys: string[]): Promise<SeekerVerificationRequest> {
    const [req] = await db.select().from(seekerVerificationRequests).where(eq(seekerVerificationRequests.id, requestId)).limit(1);
    if (!req) throw new Error("Request not found");
    const existing = req.requirementsSnapshot || [];
    const merged = Array.from(new Set([...existing, ...keys]));
    const hasNewKeys = merged.length > existing.length;
    const updates: Record<string, any> = { requirementsSnapshot: merged, updatedAt: new Date() };
    if (hasNewKeys && req.status === "submitted") {
      updates.status = "needs_more";
      updates.adminNotes = (req.adminNotes ? req.adminNotes + "\n" : "") +
        "[System] New credential requirements added from job application. Status reverted to needs_more.";
    }
    const [updated] = await db.update(seekerVerificationRequests)
      .set(updates)
      .where(eq(seekerVerificationRequests.id, requestId))
      .returning();
    return updated;
  }

  async getSeekerVerificationRequestsByStatus(statuses: string[]): Promise<(SeekerVerificationRequest & { seekerName: string | null; seekerEmail: string; seekerTrack: string | null; cdlIsNonDomiciled: boolean; cdlMarkedNonDomiciledIssuingState: boolean })[]> {
    const rows = await db
      .select({
        id: seekerVerificationRequests.id,
        seekerId: seekerVerificationRequests.seekerId,
        status: seekerVerificationRequests.status,
        requirementsSnapshot: seekerVerificationRequests.requirementsSnapshot,
        adminNotes: seekerVerificationRequests.adminNotes,
        decidedBy: seekerVerificationRequests.decidedBy,
        decidedAt: seekerVerificationRequests.decidedAt,
        submittedAt: seekerVerificationRequests.submittedAt,
        createdAt: seekerVerificationRequests.createdAt,
        updatedAt: seekerVerificationRequests.updatedAt,
        seekerName: sql<string | null>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email})`.as("seeker_name"),
        seekerEmail: users.email,
        seekerTrack: users.seekerTrack,
        cdlIsNonDomiciled: users.cdlIsNonDomiciled,
        cdlMarkedNonDomiciledIssuingState: users.cdlMarkedNonDomiciledIssuingState,
      })
      .from(seekerVerificationRequests)
      .innerJoin(users, eq(seekerVerificationRequests.seekerId, users.id))
      .where(inArray(seekerVerificationRequests.status, statuses))
      .orderBy(desc(seekerVerificationRequests.submittedAt));
    return rows;
  }

  async updateSeekerVerificationRequestStatus(requestId: number, status: string, adminNotes?: string, decidedBy?: number): Promise<SeekerVerificationRequest> {
    const updates: Record<string, any> = { status, updatedAt: new Date() };
    if (adminNotes !== undefined) updates.adminNotes = adminNotes;
    if (decidedBy !== undefined) updates.decidedBy = decidedBy;
    if (status === "submitted") updates.submittedAt = new Date();
    if (["verified", "rejected"].includes(status)) updates.decidedAt = new Date();
    const [req] = await db.update(seekerVerificationRequests)
      .set(updates)
      .where(eq(seekerVerificationRequests.id, requestId))
      .returning();
    return req;
  }

  async createSeekerEvidenceItem(item: InsertSeekerCredentialEvidenceItem): Promise<SeekerCredentialEvidenceItem> {
    const [evidence] = await db.insert(seekerCredentialEvidenceItems).values(item).returning();
    return evidence;
  }

  async getSeekerEvidenceItemsByRequest(requestId: number): Promise<SeekerCredentialEvidenceItem[]> {
    return await db.select().from(seekerCredentialEvidenceItems)
      .where(eq(seekerCredentialEvidenceItems.requestId, requestId))
      .orderBy(desc(seekerCredentialEvidenceItems.createdAt));
  }

  async updateSeekerVerificationStatus(seekerId: number, status: string): Promise<User> {
    const [user] = await db.update(users)
      .set({ seekerVerificationStatus: status })
      .where(eq(users.id, seekerId))
      .returning();
    return user;
  }

  async getOrCreateConversation(seekerId: number, employerId: number, jobId?: number | null): Promise<Conversation> {
    const existing = await db.select().from(conversations)
      .where(
        jobId
          ? and(eq(conversations.seekerId, seekerId), eq(conversations.employerId, employerId), eq(conversations.jobId, jobId))
          : and(eq(conversations.seekerId, seekerId), eq(conversations.employerId, employerId), sql`${conversations.jobId} IS NULL`)
      )
      .limit(1);
    if (existing.length > 0) return existing[0];
    const [conv] = await db.insert(conversations)
      .values({ seekerId, employerId, jobId: jobId ?? null })
      .returning();
    return conv;
  }

  async getConversations(userId: number): Promise<(Conversation & { otherPartyName: string; lastMessage: string | null; unreadCount: number })[]> {
    const convs = await db.select().from(conversations)
      .where(sql`${conversations.seekerId} = ${userId} OR ${conversations.employerId} = ${userId}`)
      .orderBy(desc(conversations.lastMessageAt));

    const results = await Promise.all(convs.map(async (conv) => {
      const otherUserId = conv.seekerId === userId ? conv.employerId : conv.seekerId;
      const [otherUser] = await db.select({
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        companyName: users.companyName,
      }).from(users).where(eq(users.id, otherUserId)).limit(1);

      const otherPartyName = otherUser
        ? (otherUser.firstName && otherUser.lastName
          ? `${otherUser.firstName} ${otherUser.lastName}`
          : otherUser.companyName || otherUser.email)
        : "Unknown";

      const lastMsgs = await db.select().from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);

      const [unreadResult] = await db.select({ cnt: count() }).from(messages)
        .where(and(
          eq(messages.conversationId, conv.id),
          eq(messages.isRead, false),
          sql`${messages.senderId} != ${userId}`
        ));

      return {
        ...conv,
        otherPartyName: otherPartyName as string,
        lastMessage: lastMsgs[0]?.content ?? null,
        unreadCount: Number(unreadResult?.cnt ?? 0),
      };
    }));
    return results;
  }

  async getMessages(conversationId: number): Promise<Message[]> {
    return db.select().from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt));
  }

  async createMessage(conversationId: number, senderId: number, content: string): Promise<Message> {
    const [msg] = await db.insert(messages)
      .values({ conversationId, senderId, content, isRead: false })
      .returning();
    await db.update(conversations)
      .set({ lastMessageAt: new Date() })
      .where(eq(conversations.id, conversationId));
    return msg;
  }

  async markConversationRead(conversationId: number, userId: number): Promise<void> {
    await db.update(messages)
      .set({ isRead: true })
      .where(and(
        eq(messages.conversationId, conversationId),
        eq(messages.isRead, false),
        sql`${messages.senderId} != ${userId}`
      ));
  }

  async getUnreadMessageCount(userId: number): Promise<number> {
    const userConvs = await db.select({ id: conversations.id }).from(conversations)
      .where(sql`${conversations.seekerId} = ${userId} OR ${conversations.employerId} = ${userId}`);
    if (userConvs.length === 0) return 0;
    const convIds = userConvs.map((c) => c.id);
    const [result] = await db.select({ cnt: count() }).from(messages)
      .where(and(
        inArray(messages.conversationId, convIds),
        eq(messages.isRead, false),
        sql`${messages.senderId} != ${userId}`
      ));
    return Number(result?.cnt ?? 0);
  }

  async getConversationUnreadCount(conversationId: number, recipientId: number): Promise<number> {
    const [result] = await db.select({ cnt: count() }).from(messages)
      .where(and(
        eq(messages.conversationId, conversationId),
        eq(messages.isRead, false),
        sql`${messages.senderId} != ${recipientId}`
      ));
    return Number(result?.cnt ?? 0);
  }

  async getConversation(conversationId: number): Promise<Conversation | undefined> {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    return conv;
  }

  async getEmployerApplicationsEnriched(employerId: number): Promise<(Application & { seekerName: string; seekerEmail: string })[]> {
    const myJobs = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.employerId, employerId));
    const jobIds = myJobs.map((j) => j.id);
    if (jobIds.length === 0) return [];

    const apps = await db.select().from(applications).where(inArray(applications.jobId, jobIds));
    const seekerIds = [...new Set(apps.map((a) => a.jobSeekerId))];
    const seekers =
      seekerIds.length > 0
        ? await db
            .select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName })
            .from(users)
            .where(inArray(users.id, seekerIds))
        : [];

    const seekerMap = new Map(seekers.map((s) => [s.id, s]));
    return apps.map((a) => {
      const seeker = seekerMap.get(a.jobSeekerId);
      const seekerName =
        seeker
          ? seeker.firstName && seeker.lastName
            ? `${seeker.firstName} ${seeker.lastName}`
            : seeker.email
          : `Applicant #${a.jobSeekerId}`;
      return { ...a, seekerName, seekerEmail: seeker?.email ?? "" };
    });
  }

  // ── Email Templates ────────────────────────────────────────────────────────
  async getEmailTemplates(): Promise<EmailTemplate[]> {
    return await db.select().from(emailTemplates).orderBy(asc(emailTemplates.slug));
  }

  async getEmailTemplateBySlug(slug: string): Promise<EmailTemplate | undefined> {
    const [t] = await db.select().from(emailTemplates).where(eq(emailTemplates.slug, slug));
    return t;
  }

  async upsertEmailTemplate(slug: string, data: Partial<InsertEmailTemplate>): Promise<EmailTemplate> {
    const now = new Date();
    const existing = await this.getEmailTemplateBySlug(slug);
    if (existing) {
      const [updated] = await db
        .update(emailTemplates)
        .set({ ...data, updatedAt: now })
        .where(eq(emailTemplates.slug, slug))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(emailTemplates)
      .values({ slug, name: data.name ?? slug, subject: data.subject ?? "", body: data.body ?? "", variables: data.variables ?? [], isActive: data.isActive ?? true, ...data })
      .returning();
    return created;
  }
}

export const storage = new DatabaseStorage();