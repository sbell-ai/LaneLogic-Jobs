import { db } from "./db";
import {
  users, jobs, applications, resources, blogPosts, resumes, siteSettings, categories, coupons, pages,
  importRuns, importArtifacts, socialPosts,
  adminProducts, adminEntitlements, adminProductOverrides, adminProductEntitlements, migrationState,
  entitlementUsageWindows, entitlementCreditGrants, entitlementCreditConsumptions,
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
  type SiteSettingsData, DEFAULT_SETTINGS
} from "@shared/schema";
import { eq, and, sql, desc, asc, isNotNull, gte, lte, gt } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
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

  // Resources
  getResources(context?: "admin" | "public"): Promise<Resource[]>;
  getResource(id: number): Promise<Resource | undefined>;
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
  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
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
  async createApplication(insertApp: InsertApplication): Promise<Application> {
    const [app] = await db.insert(applications).values(insertApp).returning();
    return app;
  }
  async updateApplication(id: number, updates: Partial<InsertApplication>): Promise<Application> {
    const [app] = await db.update(applications).set(updates).where(eq(applications.id, id)).returning();
    return app;
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
  async createResource(resource: InsertResource): Promise<Resource> {
    const [res] = await db.insert(resources).values(resource).returning();
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
  async getOrCreateUsageWindow(userId: number, entitlementKey: string, windowStart: Date, windowEnd: Date): Promise<EntitlementUsageWindow> {
    const [w] = await db.insert(entitlementUsageWindows).values({
      userId, entitlementKey, windowStart, windowEnd, usedCount: 0
    }).onConflictDoNothing().returning();
    if (w) return w;
    const [existing] = await db.select().from(entitlementUsageWindows).where(
      and(
        eq(entitlementUsageWindows.userId, userId),
        eq(entitlementUsageWindows.entitlementKey, entitlementKey),
        eq(entitlementUsageWindows.windowStart, windowStart)
      )
    );
    return existing;
  }

  async incrementUsageWindow(windowId: number): Promise<EntitlementUsageWindow> {
    const [w] = await db.update(entitlementUsageWindows)
      .set({ usedCount: sql`${entitlementUsageWindows.usedCount} + 1` })
      .where(eq(entitlementUsageWindows.id, windowId))
      .returning();
    return w;
  }

  async incrementUsageWindowAtomic(windowId: number, maxCount: number): Promise<EntitlementUsageWindow | null> {
    const rows = await db.update(entitlementUsageWindows)
      .set({ usedCount: sql`${entitlementUsageWindows.usedCount} + 1` })
      .where(and(
        eq(entitlementUsageWindows.id, windowId),
        sql`${entitlementUsageWindows.usedCount} < ${maxCount}`
      ))
      .returning();
    return rows.length > 0 ? rows[0] : null;
  }

  // Entitlement Credit Grants
  async createCreditGrant(grant: InsertEntitlementCreditGrant): Promise<EntitlementCreditGrant> {
    const [g] = await db.insert(entitlementCreditGrants).values(grant).returning();
    return g;
  }

  async getActiveCreditGrants(userId: number, entitlementKey: string): Promise<EntitlementCreditGrant[]> {
    const now = new Date();
    return await db.select().from(entitlementCreditGrants).where(
      and(
        eq(entitlementCreditGrants.userId, userId),
        eq(entitlementCreditGrants.entitlementKey, entitlementKey),
        eq(entitlementCreditGrants.status, "Active"),
        gt(entitlementCreditGrants.amountRemaining, 0),
        gt(entitlementCreditGrants.expiresAt, now)
      )
    ).orderBy(asc(entitlementCreditGrants.expiresAt), asc(entitlementCreditGrants.grantedAt));
  }

  async consumeCreditFromGrant(grantId: number, amount: number): Promise<EntitlementCreditGrant> {
    const [g] = await db.update(entitlementCreditGrants)
      .set({ amountRemaining: sql`${entitlementCreditGrants.amountRemaining} - ${amount}` })
      .where(and(
        eq(entitlementCreditGrants.id, grantId),
        gte(entitlementCreditGrants.amountRemaining, amount)
      ))
      .returning();
    return g;
  }

  async createCreditConsumption(consumption: InsertEntitlementCreditConsumption): Promise<EntitlementCreditConsumption> {
    const [c] = await db.insert(entitlementCreditConsumptions).values(consumption).returning();
    return c;
  }

  async getUserCreditSummary(userId: number, entitlementKey: string): Promise<{ totalRemaining: number; grants: EntitlementCreditGrant[] }> {
    const grants = await this.getActiveCreditGrants(userId, entitlementKey);
    const totalRemaining = grants.reduce((sum, g) => sum + g.amountRemaining, 0);
    return { totalRemaining, grants };
  }

  async getCreditGrantByPaymentIntent(paymentIntentId: string): Promise<EntitlementCreditGrant | undefined> {
    const [g] = await db.select().from(entitlementCreditGrants).where(
      eq(entitlementCreditGrants.stripePaymentIntentId, paymentIntentId)
    );
    return g;
  }
}

export const storage = new DatabaseStorage();